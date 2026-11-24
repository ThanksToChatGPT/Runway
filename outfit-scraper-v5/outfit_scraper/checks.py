from itertools import islice

from .adapters import get_adapter
from .normalizer import normalize
from .polite_http import CircuitOpen, RobotsDisallowed
from .runner import make_client


def check_store(store, settings, limit=5, out=print):
    """Test a store without saving anything. Returns True when at least one usable product was read."""
    store = {**store, "config": store.get("config", {})}
    out(f"\n== {store['name']} ({store['platform']}) {store['base_url']}")
    client = make_client(settings)
    try:
        out("  robots.txt: " + ("allowed" if client.allowed(store["base_url"] + "/") else "BLOCKED for our user agent"))
        sample = list(islice(get_adapter(store, client, limit).fetch(), limit))
    except (RobotsDisallowed, CircuitOpen) as exc:
        out(f"  FAIL: {exc}")
        return False
    except Exception as exc:
        out(f"  FAIL: {exc}")
        if "HTTP 401" in str(exc) or "HTTP 403" in str(exc):
            out("  HINT: this store does not allow anonymous access to that API. Find the right one with:\n"
                f"        python -m outfit_scraper detect {store['base_url']}")
        return False
    finally:
        client.session.close()
    good = 0
    for raw in sample:
        product, reason = normalize(raw, store)
        if product:
            good += 1
            sizes = ",".join(f"{s}{'' if ok else '(x)'}" for s, ok in product.sizes) or "-"
            units = "unknown" if product.units_total is None else product.units_total
            out(f"  OK  {product.name[:36]:36} ${product.price_cop:>10,.0f}  {product.category}/{product.subcategory or '-'}"
                f"  color={product.color or '-'} units={units} sizes={sizes} images={len(product.images)}")
        else:
            out(f"  --  {raw.url}: {reason}")
    out(f"  {'PASS' if good else 'FAIL'}: {good}/{len(sample)} usable products read")
    return good > 0
