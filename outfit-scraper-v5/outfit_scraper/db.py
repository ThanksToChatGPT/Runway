"""SQLite storage. Tables follow the UML classes: Store, Product, ProductImage, ProductSizeStock, ScrapingLog."""
import json
import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS store (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL,
    platform TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1, last_scraped_at TEXT);
CREATE TABLE IF NOT EXISTS product (
    id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES store(id),
    name TEXT NOT NULL, brand TEXT, category TEXT, subcategory TEXT, material TEXT, color TEXT,
    price_cop REAL NOT NULL, external_url TEXT NOT NULL, last_price_update TEXT,
    is_hidden INTEGER NOT NULL DEFAULT 0, updated_at TEXT, units_total INTEGER,
    pack_size INTEGER NOT NULL DEFAULT 1, pack_evidence TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS product_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL REFERENCES product(id),
    image_url TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, kind TEXT);
CREATE TABLE IF NOT EXISTS product_size_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL REFERENCES product(id),
    size TEXT NOT NULL, is_available INTEGER NOT NULL DEFAULT 1, units INTEGER);
CREATE TABLE IF NOT EXISTS scraping_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, store_id TEXT NOT NULL REFERENCES store(id),
    execution_date TEXT NOT NULL, status TEXT NOT NULL, errors TEXT NOT NULL DEFAULT '',
    products_found INTEGER NOT NULL DEFAULT 0, products_saved INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS ix_product_store ON product(store_id);
CREATE INDEX IF NOT EXISTS ix_image_product ON product_image(product_id);
CREATE INDEX IF NOT EXISTS ix_size_product ON product_size_stock(product_id);
"""


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _migrate(conn):
    """Databases created by an older version get the new columns."""
    def columns(table):
        return {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
    for table, column, ddl in (("product", "units_total", "INTEGER"), ("product_size_stock", "units", "INTEGER"),
                               ("product_image", "kind", "TEXT"),
                               ("product", "pack_size", "INTEGER NOT NULL DEFAULT 1"),
                               ("product", "pack_evidence", "TEXT NOT NULL DEFAULT ''")):
        if column not in columns(table):
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
    conn.commit()


def connect(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    _migrate(conn)
    return conn


def upsert_store(conn, store):
    conn.execute(
        """INSERT INTO store (id, name, base_url, platform, config, is_active) VALUES (?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, base_url=excluded.base_url,
           platform=excluded.platform, config=excluded.config, is_active=excluded.is_active""",
        (store["id"], store["name"], store["base_url"].rstrip("/"), store["platform"],
         json.dumps(store.get("config", {})), 1 if store.get("is_active", True) else 0))
    conn.commit()


def get_stores(conn, only_active=False, store_id=None):
    sql, args = "SELECT * FROM store", []
    cond = []
    if only_active:
        cond.append("is_active = 1")
    if store_id:
        cond.append("id = ?")
        args.append(store_id)
    if cond:
        sql += " WHERE " + " AND ".join(cond)
    stores = []
    for row in conn.execute(sql + " ORDER BY name", args):
        d = dict(row)
        d["config"] = json.loads(d["config"] or "{}")
        stores.append(d)
    return stores


def save_product(conn, p):
    stamp = now()
    old = conn.execute("SELECT price_cop FROM product WHERE id = ?", (p.id,)).fetchone()
    price_changed = old is None or abs(old["price_cop"] - p.price_cop) > 0.5
    if old is None:
        conn.execute(
            """INSERT INTO product (id, store_id, name, brand, category, subcategory, material, color,
               price_cop, external_url, last_price_update, is_hidden, updated_at, units_total,
               pack_size, pack_evidence)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)""",
            (p.id, p.store_id, p.name, p.brand, p.category, p.subcategory, p.material, p.color,
             p.price_cop, p.external_url, stamp, stamp, p.units_total,
             int(p.pack_size or 1), p.pack_evidence or ""))
    else:  # keep is_hidden: an administrator may have hidden this product
        conn.execute(
            """UPDATE product SET name=?, brand=?, category=?, subcategory=?, material=?, color=?,
               price_cop=?, external_url=?, updated_at=?, units_total=?,
               pack_size=?, pack_evidence=?,
               last_price_update = CASE WHEN ? THEN ? ELSE last_price_update END WHERE id=?""",
            (p.name, p.brand, p.category, p.subcategory, p.material, p.color, p.price_cop,
             p.external_url, stamp, p.units_total, int(p.pack_size or 1), p.pack_evidence or "",
             1 if price_changed else 0, stamp, p.id))
    conn.execute("DELETE FROM product_image WHERE product_id = ?", (p.id,))
    conn.execute("DELETE FROM product_size_stock WHERE product_id = ?", (p.id,))
    # only the URL of each image is stored, never the image itself
    conn.executemany("INSERT INTO product_image (product_id, image_url, is_primary, kind) VALUES (?,?,?,?)",
                     [(p.id, url, 1 if i == 0 else 0, p.image_kinds.get(url, "")) for i, url in enumerate(p.images)])
    conn.executemany("INSERT INTO product_size_stock (product_id, size, is_available, units) VALUES (?,?,?,?)",
                     [(p.id, size, 1 if ok else 0, p.size_units.get(size)) for size, ok in p.sizes])


def start_log(conn, store_id):
    cur = conn.execute("INSERT INTO scraping_log (store_id, execution_date, status) VALUES (?,?,'running')",
                       (store_id, now()))
    conn.commit()
    return cur.lastrowid


def finish_log(conn, log_id, status, errors, found, saved):
    conn.execute("UPDATE scraping_log SET status=?, errors=?, products_found=?, products_saved=? WHERE id=?",
                 (status, "\n".join(errors)[:4000], found, saved, log_id))
    conn.commit()


# ---------- queries used by the viewer ----------
def stats(conn):
    one = lambda sql: conn.execute(sql).fetchone()[0]
    return {
        "products": one("SELECT COUNT(*) FROM product WHERE is_hidden = 0"),
        "packs": one("SELECT COUNT(*) FROM product WHERE is_hidden = 0 AND pack_size > 1"),
        "stores": one("SELECT COUNT(*) FROM store"),
        "active_stores": one("SELECT COUNT(*) FROM store WHERE is_active = 1"),
        "last_run": conn.execute("SELECT MAX(execution_date) FROM scraping_log").fetchone()[0],
        "categories": {r["category"] or "other": r["n"] for r in conn.execute(
            "SELECT category, COUNT(*) n FROM product WHERE is_hidden = 0 GROUP BY category")},
    }


def stores_status(conn):
    rows = []
    for s in get_stores(conn):
        log = conn.execute("SELECT * FROM scraping_log WHERE store_id=? ORDER BY id DESC LIMIT 1", (s["id"],)).fetchone()
        count = conn.execute("SELECT COUNT(*) FROM product WHERE store_id=?", (s["id"],)).fetchone()[0]
        rows.append({"id": s["id"], "name": s["name"], "base_url": s["base_url"], "platform": s["platform"],
                     "is_active": bool(s["is_active"]), "last_scraped_at": s["last_scraped_at"],
                     "products": count, "last_status": log["status"] if log else None,
                     "last_errors": log["errors"] if log else ""})
    return rows


def logs(conn, limit=50):
    return [dict(r) for r in conn.execute(
        """SELECT l.id, l.store_id, s.name AS store_name, l.execution_date, l.status, l.errors,
                  l.products_found, l.products_saved
           FROM scraping_log l JOIN store s ON s.id = l.store_id ORDER BY l.id DESC LIMIT ?""", (limit,))]


def list_products(conn, q="", store="", category="", subcategory="", color="", size="",
                  min_price=None, max_price=None, sort="updated", limit=60, offset=0,
                  single_garment=False):
    where, args = ["p.is_hidden = 0"], []
    if q:
        where.append("(p.name LIKE ? OR p.brand LIKE ?)")
        args += [f"%{q}%", f"%{q}%"]
    for col, val in (("p.store_id", store), ("p.category", category), ("p.subcategory", subcategory), ("p.color", color)):
        if val:
            where.append(f"{col} = ?")
            args.append(val)
    if size:
        where.append("EXISTS (SELECT 1 FROM product_size_stock z WHERE z.product_id = p.id AND z.size = ? AND z.is_available = 1)")
        args.append(size)
    if single_garment:      # only products that are one garment (pack_size 1); packs are hidden
        where.append("COALESCE(p.pack_size, 1) = 1")
    if min_price is not None:
        where.append("p.price_cop >= ?")
        args.append(min_price)
    if max_price is not None:
        where.append("p.price_cop <= ?")
        args.append(max_price)
    order = {"price_asc": "p.price_cop ASC", "price_desc": "p.price_cop DESC", "name": "p.name ASC"}.get(sort, "p.updated_at DESC, p.name")
    base = " FROM product p JOIN store s ON s.id = p.store_id WHERE " + " AND ".join(where)
    total = conn.execute("SELECT COUNT(*)" + base, args).fetchone()[0]
    rows = conn.execute("SELECT p.*, s.name AS store_name" + base + f" ORDER BY {order} LIMIT ? OFFSET ?",
                        args + [limit, offset]).fetchall()
    items = []
    for r in rows:
        d = dict(r)
        d["images"] = [{"url": i["image_url"], "kind": i["kind"] or ""} for i in conn.execute(
            "SELECT image_url, kind FROM product_image WHERE product_id=? ORDER BY is_primary DESC, id", (r["id"],))]
        d["sizes"] = [{"size": z["size"], "available": bool(z["is_available"]), "units": z["units"]} for z in conn.execute(
            "SELECT size, is_available, units FROM product_size_stock WHERE product_id=? ORDER BY id", (r["id"],))]
        items.append(d)
    return {"total": total, "items": items}


def delete_store(conn, store_id):
    """Remove a store with all its products, images, sizes and logs."""
    ids = "(SELECT id FROM product WHERE store_id = ?)"
    conn.execute(f"DELETE FROM product_image WHERE product_id IN {ids}", (store_id,))
    conn.execute(f"DELETE FROM product_size_stock WHERE product_id IN {ids}", (store_id,))
    conn.execute("DELETE FROM product WHERE store_id = ?", (store_id,))
    conn.execute("DELETE FROM scraping_log WHERE store_id = ?", (store_id,))
    conn.execute("DELETE FROM store WHERE id = ?", (store_id,))
    conn.commit()
