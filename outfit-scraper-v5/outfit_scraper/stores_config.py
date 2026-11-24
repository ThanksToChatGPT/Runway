"""Reads and writes stores.json (stores and settings) so the menu can add, remove and change things."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse


def load_raw(path):
    p = Path(path)
    if not p.exists():
        return {"settings": {}, "stores": []}
    return json.loads(p.read_text(encoding="utf-8"))


def save_raw(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def unique_id(stores, wanted):
    taken = {s["id"] for s in stores}
    new, n = wanted, 2
    while new in taken:
        new, n = f"{wanted}-{n}", n + 1
    return new


def add_store(path, entry):
    """Adds the store (or updates the one with the same base_url). Returns the saved entry."""
    data = load_raw(path)
    stores = data.setdefault("stores", [])
    base = entry["base_url"].rstrip("/")
    for i, s in enumerate(stores):
        if s["base_url"].rstrip("/") == base:
            stores[i] = {**s, **entry, "id": s["id"]}
            save_raw(path, data)
            return stores[i]
    entry = {**entry, "id": unique_id(stores, entry["id"])}
    stores.append(entry)
    save_raw(path, data)
    return entry


def remove_store(path, store_id):
    data = load_raw(path)
    before = len(data.get("stores", []))
    data["stores"] = [s for s in data.get("stores", []) if s["id"] != store_id]
    save_raw(path, data)
    return len(data["stores"]) < before


def set_active(path, store_id, active):
    data = load_raw(path)
    for s in data.get("stores", []):
        if s["id"] == store_id:
            s["is_active"] = bool(active)
            save_raw(path, data)
            return True
    return False


def set_setting(path, key, value):
    data = load_raw(path)
    data.setdefault("settings", {})[key] = value
    save_raw(path, data)


def slug_from_url(url):
    host = urlparse(url if "//" in url else "https://" + url).netloc
    return re.sub(r"\W+", "-", host.replace("www.", "")).strip("-").split("-")[0] or "store"
