"""Runs the collection: one store at a time, a failure in one store never stops the others."""
import json
import os
import time

from . import db, image_picker
from .adapters import get_adapter
from .normalizer import normalize
from .polite_http import CircuitOpen, PoliteClient, RobotsDisallowed, make_client_from

DEFAULT_SETTINGS = {
    "user_agent": "OutfitFinderBot/1.0 (university project; contact: team@example.com)",
    "delay_seconds": 2.0,          # wait between requests to the same store
    "respect_robots": True,
    "retries": 3,
    "max_failures": 5,
    "max_products_per_store": None,    # None = read every page the store allows
    "single_garment": True,        # keep only products that are ONE garment (no packs of 3, no kits)
    "image_analysis": True,        # look at the images to prefer the garment alone (needs Pillow)
    "image_candidates": 3,         # how many images per product to look at
    "image_delay_seconds": 0.4,    # wait between image downloads (images are never stored, only their URLs)
}


class ConfigError(Exception):
    pass


def load_config(path):
    if not os.path.exists(path):
        return dict(DEFAULT_SETTINGS), []
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        line = text.splitlines()[exc.lineno - 1] if text.splitlines() else ""
        raise ConfigError(f"{path} is not valid JSON: {exc.msg} at line {exc.lineno}, column {exc.colno}.\n"
                          f"    {line.strip()}\n"
                          f"    Look at the end of the previous line: two stores in the list need a comma between them, "
                          f"and the last one must not have a comma after it.")
    settings = {**DEFAULT_SETTINGS, **data.get("settings", {})}
    return settings, data.get("stores", [])


def make_client(settings):
    return make_client_from(settings)


def _image_fetcher(settings):
    """Returns a function url -> bytes (or None), or None when images should not be analysed."""
    if not settings.get("image_analysis") or not image_picker.HAVE_PIL:
        return None
    client = PoliteClient(settings["user_agent"], delay=settings["image_delay_seconds"], retries=1,
                          respect_robots=settings["respect_robots"], max_failures=50)

    def fetch(url):
        try:
            r = client.fetch_any(url)
        except Exception:
            return None
        return r.content if r.status_code == 200 and len(r.content) <= 3_000_000 else None
    fetch.client = client
    return fetch


def run_store(conn, store, settings, max_products=None, on_product=None):
    """Collect one store and write a ScrapingLog row. Returns a summary dict."""
    limit = max_products or settings.get("max_products_per_store")
    log_id = db.start_log(conn, store["id"])
    client = make_client(settings)
    fetch_image = _image_fetcher(settings)
    single = store.get("config", {}).get("single_garment", settings.get("single_garment", True))
    found = saved = skipped_packs = skipped_non_garment = 0
    errors = []
    try:
        adapter = get_adapter(store, client, limit)
        for raw in adapter.fetch():
            found += 1
            try:
                product, reason = normalize(raw, store)
                if product is None:
                    errors.append(f"skipped {raw.url or raw.external_id}: {reason}")
                    continue
                if single:
                    if (product.pack_size or 1) > 1:          # a pack of N garments is not "1 garment"
                        skipped_packs += 1
                        continue
                    if product.category == "other" and not product.sizes:
                        skipped_non_garment += 1            # utility item ("Calcula tu envío"), not clothing
                        continue
                product.images, product.image_kinds = image_picker.pick_images(
                    product.images, raw.image_meta, fetch_image, settings.get("image_candidates", 3))
                db.save_product(conn, product)
                saved += 1
                if on_product:
                    on_product(product)
            except Exception as exc:                    # one bad product must not stop the store
                errors.append(f"error on {raw.url or raw.external_id}: {exc}")
        conn.commit()
    except (RobotsDisallowed, CircuitOpen) as exc:
        errors.append(f"stopped: {exc}")
    except Exception as exc:
        errors.append(f"failed: {exc}")
    finally:
        client.session.close()
        if fetch_image:
            fetch_image.client.session.close()
    notes = []
    if skipped_packs:
        notes.append(f"info: {skipped_packs} products skipped because they are packs/kits of several garments "
                     f"(single_garment is on; set it to false to keep them)")
    if skipped_non_garment:
        notes.append(f"info: {skipped_non_garment} items skipped because they are not garments "
                     f"(no category, no sizes: delivery calculators, gift cards...)")
    if found == 0 and not errors:
        errors.append("no products found")
    status = ("partial" if saved else "failed") if errors else "success"
    if saved:
        conn.execute("UPDATE store SET last_scraped_at = ? WHERE id = ?", (db.now(), store["id"]))
    db.finish_log(conn, log_id, status, (errors[:200] + notes), found, saved)
    return {"store": store["id"], "status": status, "found": found, "saved": saved,
            "skipped_packs": skipped_packs, "skipped_non_garment": skipped_non_garment,
            "requests": client.requests_made, "errors": errors[:5], "notes": notes}


def run_all(conn, settings, store_id=None, max_products=None, progress=None, on_product=None):
    stores = db.get_stores(conn, only_active=store_id is None, store_id=store_id)
    results = []
    for store in stores:
        if progress:
            progress(store)
        results.append(run_store(conn, store, settings, max_products, on_product))
    return results


def schedule(conn, settings, every_hours, max_products=None):
    """Simple scheduler: run all active stores, wait, repeat. Stop with Ctrl+C."""
    while True:
        for r in run_all(conn, settings, max_products=max_products):
            print(f"[{db.now()}] {r['store']}: {r['status']} ({r['saved']}/{r['found']} saved)", flush=True)
        time.sleep(every_hours * 3600)
