"""Export the collected catalog to a JSON snapshot the front can bundle.

The React front tries the live API first; when the scraper is not running it loads this
snapshot instead, so the app always works with real data (FR-34/36 persistence, RNF-13:
search keeps working over previously collected data even when collection is down).
"""
import json
from datetime import datetime, timezone
from pathlib import Path


def export(conn, out_path, limit_per_page=200):
    """Write the full visible catalog (products, images, sizes, stores) as one JSON file."""
    from . import db

    items, offset, total = [], 0, float("inf")
    while offset < total:
        page = db.list_products(conn, single_garment=True, limit=limit_per_page, offset=offset)
        total, _ = page["total"], items.extend(page["items"])
        offset += limit_per_page
    stores = [{"id": s["id"], "name": s["name"]} for s in db.stores_status(conn)]
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "stores": stores,
        "products": items,
    }
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return len(items), path
