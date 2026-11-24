"""Interactive menu: everything the scraper can do, one number at a time."""
import webbrowser
from pathlib import Path

from . import db, demo_store, stores_config as sc
from .checks import check_store
from .detect import detect, grep_html
from .runner import ConfigError, DEFAULT_SETTINGS, load_config, run_all, schedule

MENU = """
==================== Outfit scraper ====================
  1) Add a store (only the URL: the platform is detected automatically)
  2) List stores
  3) Detect the platform of a URL and test its public APIs
  4) Test a store (reads a few products, saves nothing)
  5) Collect products now (scrapes every page it can; keeps single garments)
  6) Collect automatically every N hours
  7) Open the viewer in the browser (image carousel included)
  8) Search keywords (grep) in a page or a saved HTML file
  9) Activate, deactivate or remove a store
 10) Settings (single-garment filter, images, delay...)
 11) Show the latest scraping logs
 12) Demo with fake stores
 13) Search the collected products (filters, no scraping)
 14) Show database info: detect the engine and test its API
  0) Exit

Tips: to add Mattelsa type 1 and paste https://www.mattelsa.net
      'single garment' means the product is ONE piece (no packs of 3 socks, no kits)
"""

SETTING_HELP = {
    "single_garment": "keep only products that are ONE garment, no packs/kits of several ('on'/'off')",
    "image_analysis": "look at the images to prefer the garment alone, needs Pillow ('on'/'off')",
    "image_candidates": "how many images per product to look at (number)",
    "delay_seconds": "seconds to wait between requests to the same store (2 or more is polite)",
    "max_products_per_store": "limit of products per store (number, or 'all' to read every page)",
    "user_agent": "name we send to the stores: put your email in it",
}


def ask(prompt, default=""):
    try:
        text = input(f"{prompt}{f' [{default}]' if default != '' else ''}: ").strip()
    except EOFError:
        raise KeyboardInterrupt
    return text or default


def yes(prompt, default=True):
    answer = ask(f"{prompt} ({'Y/n' if default else 'y/N'})", "").lower()
    return default if not answer else answer.startswith(("y", "s"))


def _load(config):
    settings, stores = load_config(config)
    return settings, stores


def _connect(db_path, stores):
    conn = db.connect(db_path)
    for s in stores:
        db.upsert_store(conn, s)
    return conn


# ---------------------------------------------------------------- 1 add a store
def add_store_by_url(config, db_path, url, name=None, interactive=True, out=print):
    """Detects the platform from the URL, checks the stock information and saves the store. Returns the entry or None."""
    settings, _ = _load(config)
    result = detect(url, settings, out=out, snippet=False, save=False)
    entry = result["recommended"]
    if not entry:
        out("\nThis store could not be added automatically: no supported public API answered.")
        return None
    entry = {**entry, "id": sc.slug_from_url(url), "name": name or entry["name"]}
    if interactive:
        entry["name"] = ask("Name for this store", entry["name"])
    packs = result.get("stock", {}).get("packs")
    if packs:
        out(f"\nNote: {packs['count']} of {packs['sample']} sample products look like packs/kits "
            f"(several garments sold together); the single-garment filter will skip them.")
    saved = sc.add_store(config, entry)
    _, stores = _load(config)
    conn = _connect(db_path, stores)
    conn.close()
    out(f"\nStore saved in {config} as '{saved['id']}' ({saved['platform']}).")
    if interactive and yes("Read a few products now to check it works?", True):
        check_store(saved, settings, 5, out)
    return saved


def action_add(config, db_path):
    url = ask("Store URL (for example https://www.mystore.com)")
    if url:
        add_store_by_url(config, db_path, url)


# ---------------------------------------------------------------- 2 list
def action_list(config, db_path):
    settings, stores = _load(config)
    conn = _connect(db_path, stores)
    rows = db.stores_status(conn)
    conn.close()
    if not rows:
        print("No stores yet. Use option 1.")
        return
    print(f"\n{'#':>2}  {'id':16} {'platform':8} {'active':6} {'products':>8}  {'last status':11} last scraped")
    for i, r in enumerate(rows, 1):
        print(f"{i:>2}  {r['id'][:16]:16} {r['platform']:8} {'yes' if r['is_active'] else 'no':6} {r['products']:>8}  "
              f"{(r['last_status'] or 'never run'):11} {r['last_scraped_at'] or '-'}")
    print(f"\nGarment filter: {'single garment only (no packs)' if settings.get('single_garment', True) else 'off (packs are kept)'}")


def _pick_store(config, db_path, prompt="Which store? (number or id, empty = cancel)"):
    _, stores = _load(config)
    if not stores:
        print("No stores yet.")
        return None
    for i, s in enumerate(stores, 1):
        print(f"  {i}) {s['id']} — {s['name']} ({s['platform']}){'' if s.get('is_active', True) else ' [inactive]'}")
    choice = ask(prompt)
    if not choice:
        return None
    if choice.isdigit() and 1 <= int(choice) <= len(stores):
        return stores[int(choice) - 1]
    return next((s for s in stores if s["id"] == choice), None)


# ---------------------------------------------------------------- 3 detect / 4 check
def action_detect(config, db_path):
    settings, _ = _load(config)
    url = ask("Store URL")
    if not url:
        return
    html = ask("Saved HTML file (empty = download the home page)")
    words = ask("Extra keywords to search (separated by spaces, optional)").split()
    detect(url, settings, html_path=html or None, extra_grep=words)


def action_check(config, db_path):
    settings, _ = _load(config)
    store = _pick_store(config, db_path)
    if store:
        check_store(store, settings, 5)


# ---------------------------------------------------------------- 5 collect / 6 schedule
def action_collect(config, db_path):
    settings, stores = _load(config)
    print("  1) all active stores   2) one store   3) one store, only the first N products (quick test)")
    mode = ask("Choose", "1")
    store_id, limit = None, None
    if mode in ("2", "3"):
        store = _pick_store(config, db_path)
        if not store:
            return
        store_id = store["id"]
        if mode == "3":
            limit = int(ask("How many products", "50"))
    conn = _connect(db_path, stores)
    print("Collecting… (Ctrl+C stops and returns to the menu)")
    results = run_all(conn, settings, store_id=store_id, max_products=limit,
                      progress=lambda s: print(f"\n→ {s['name']}", flush=True))
    conn.close()
    print("\nSummary")
    for r in results:
        print(f"  {r['store']}: {r['status']} — {r['saved']} saved of {r['found']} read, {r['requests']} requests")
        for line in r["notes"] + r["errors"]:
            print("     ", line)


def action_schedule(config, db_path):
    settings, stores = _load(config)
    hours = float(ask("Collect every how many hours", "24"))
    conn = _connect(db_path, stores)
    print(f"Collecting every {hours} hours. Ctrl+C returns to the menu.")
    schedule(conn, settings, hours)


# ---------------------------------------------------------------- 7 viewer
def action_viewer(config, db_path):
    from .viewer.server import start
    settings, stores = _load(config)
    _connect(db_path, stores).close()
    server, url = start(db_path, settings, 8000)
    print(f"Viewer running at {url}")
    webbrowser.open(url)
    try:
        ask("Press Enter to stop the viewer")
    finally:
        server.shutdown()


# ---------------------------------------------------------------- 8 grep
def action_grep(config, db_path):
    settings, _ = _load(config)
    source = ask("URL or saved HTML file")
    words = ask("Keywords separated by spaces (for example: vtex shopify woocommerce)").split()
    if source and words:
        grep_html(source, words, settings)


# ---------------------------------------------------------------- 9 manage stores
def action_manage(config, db_path):
    store = _pick_store(config, db_path)
    if not store:
        return
    print("  1) activate   2) deactivate   3) remove (also deletes its products from the database)")
    choice = ask("Choose")
    if choice in ("1", "2"):
        sc.set_active(config, store["id"], choice == "1")
        print("Done.")
    elif choice == "3" and yes(f"Really remove {store['id']} and its products?", False):
        sc.remove_store(config, store["id"])
        conn = db.connect(db_path)
        db.delete_store(conn, store["id"])
        conn.close()
        print("Removed.")


# ---------------------------------------------------------------- 10 settings
def _parse_setting(key, text):
    t = text.strip().lower()
    if key == "single_garment":
        if t not in ("on", "off", "yes", "no", "true", "false", "1", "0", "si", "s"):
            raise ValueError("use 'on' or 'off'")
        return t in ("on", "yes", "true", "1", "si", "s")
    if key == "max_products_per_store":
        return None if t in ("all", "none", "off") else int(t)
    if key == "image_analysis":
        return t in ("on", "yes", "y", "true", "1", "si", "s")
    if key in ("image_candidates",):
        return int(t)
    if key == "delay_seconds":
        return float(t)
    return text.strip()


def action_settings(config, db_path):
    settings, _ = _load(config)
    keys = list(SETTING_HELP)
    for i, k in enumerate(keys, 1):
        print(f"  {i}) {k} = {settings.get(k)!r}\n       {SETTING_HELP[k]}")
    choice = ask("Number to change (empty = back)")
    if not choice.isdigit() or not 1 <= int(choice) <= len(keys):
        return
    key = keys[int(choice) - 1]
    value = ask(f"New value for {key}")
    try:
        sc.set_setting(config, key, _parse_setting(key, value))
        print("Saved.")
    except ValueError as exc:
        print(f"Not valid: {exc}")


# ---------------------------------------------------------------- 11 logs
def action_logs(config, db_path):
    _, stores = _load(config)
    conn = _connect(db_path, stores)
    rows = db.logs(conn, 10)
    conn.close()
    if not rows:
        print("No scraping logs yet.")
    for l in rows:
        print(f"{l['execution_date']}  {l['store_name'][:22]:22} {l['status']:8} read={l['products_found']} saved={l['products_saved']}")
        for line in (l["errors"] or "").splitlines()[:3]:
            print("     ", line)


# ---------------------------------------------------------------- 12 demo
def action_demo(config, db_path):
    settings, _ = _load(config)
    demo_store.run_demo(str(Path(db_path).with_name("demo.db")), settings)


# ---------------------------------------------------------------- 13 search
def action_search(config, db_path):
    """Search the collected products with the same filters as the viewer (no scraping)."""
    settings, stores = _load(config)
    conn = _connect(db_path, stores)
    try:
        q = ask("Text to search (name or brand, empty = all)")
        store_id = ask("Store id (empty = all)")
        category = ask(f"Category [top/bottom/footwear/accessory/other]", "")
        color = ask("Color (e.g. black, blue, empty = all)")
        size = ask("Size (e.g. M, 40)")
        max_price = ask("Maximum price in COP (empty = no limit)")
        data = db.list_products(conn, q=q, store=store_id, category=category, color=color, size=size,
                                max_price=float(max_price) if max_price else None, sort="price_asc", limit=40)
        money = lambda v: f"${v:,.0f}".replace(",", ".")
        print(f"\n{data['total']} products match:")
        for it in data["items"]:
            sold = "pack" if (it["pack_size"] or 1) > 1 else "single"
            print(f"  {it['name'][:42]:42} {money(it['price_cop']):>12}  {it['brand'][:14]:14} "
                  f"{(it['category'] or '-')[:9]:9} color={(it['color'] or '-'):7} sold={sold:6} imgs={len(it['images'])}")
        if not data["items"]:
            print("  (nothing yet: run option 5 first)")
    finally:
        conn.close()


# ---------------------------------------------------------------- 14 database info
# Every database engine leaves a different fingerprint in the first bytes of its file,
# like the platform fingerprints of a store's HTML. We grep for them and then we
# test the matching database API (for SQLite, the standard library's sqlite3 module).
DB_SIGNATURES = [
    ("SQLite 3", b"SQLite format 3\x00", "sqlite3"),
    ("Berkeley DB (hash)", b"\x62\x31\x05\x00", None),
    ("GDBM", b"\x1f\x13\x04\x09", None),
    ("PostgreSQL (dump)", None, None),       # a server, never a single file: detected by extension below
]
DB_EXTENSIONS = {".db": "sqlite (usual)", ".sqlite": "sqlite", ".sqlite3": "sqlite",
                 ".sql": "SQL dump (text)", ".json": "JSON document store", ".csv": "CSV data"}


def detect_db_engine(path):
    """Returns (engine, how_we_know). Reads the file signature and greps for keywords."""
    p = Path(path)
    if not p.exists():
        return None, "the file does not exist yet"
    head = p.open("rb").read(16)
    for name, magic, _api in DB_SIGNATURES:
        if magic and head.startswith(magic):
            return name, "file signature (first 16 bytes)"
    if p.suffix == ".sql":                     # a text dump: grep for the engine's keywords
        text = p.read_text(errors="ignore")[:4000].lower()
        for kw, engine in (("postgresql", "PostgreSQL"), ("mysql", "MySQL/MariaDB"), ("sqlite", "SQLite")):
            if kw in text:
                return f"{engine} (text dump)", f"keyword {kw!r} found with grep"
    return None, f"unknown signature {head[:8]!r}"


def test_db_api(engine, path, stores):
    """Probes the database API the same way `detect` probes a store's APIs."""
    if engine and engine.startswith("SQLite"):
        conn = db.connect(path)
        try:
            tables = [r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            s = db.stats(conn)
            return f"OK: sqlite3 module, {len(tables)} tables, {s['products']} products, {s['stores']} stores"
        finally:
            conn.close()
    return "no local API to test for this engine (server-based or text dump; use the backend team's migration)"


def action_dbinfo(config, db_path):
    """Detects which database the project uses (signature + grep) and tests its API."""
    settings, stores = _load(config)
    p = Path(db_path)
    engine, how = detect_db_engine(db_path)
    print(f"Database file: {p.resolve()}")
    if engine is None and p.exists():
        engine = f"unknown ({DB_EXTENSIONS.get(p.suffix, p.suffix)})"
    print(f"Engine detected: {engine}   [{how}]")
    print(f"File size: {(p.stat().st_size if p.exists() else 0):,} bytes")
    if not p.exists():
        print("The database does not exist yet: run option 5 once to create it (SQLite).")
        return
    print(f"API test: {test_db_api(engine, db_path, stores)}")
    conn = _connect(db_path, stores)
    try:
        s = db.stats(conn)
        print(f"\nProducts (visible): {s['products']}   single garments: {s['products'] - (s['packs'] or 0)}   "
              f"packs/kits: {s['packs'] or 0}")
        print(f"Stores: {s['stores']} total, {s['active_stores']} active   Last run: {s['last_run'] or '-'}")
        for cat, n in sorted(s["categories"].items()):
            print(f"  category {cat:10}: {n}")
        print("Tables:", ", ".join(r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")))
    finally:
        conn.close()


ACTIONS = {"1": action_add, "2": action_list, "3": action_detect, "4": action_check, "5": action_collect,
           "6": action_schedule, "7": action_viewer, "8": action_grep, "9": action_manage,
           "10": action_settings, "11": action_logs, "12": action_demo, "13": action_search,
           "14": action_dbinfo}


def run_menu(db_path, config):
    while True:
        print(MENU)
        try:
            choice = ask("Choose an option")
        except KeyboardInterrupt:
            print()
            return 0
        if choice in ("0", "q", "exit"):
            return 0
        action = ACTIONS.get(choice)
        if not action:
            print("Please type a number from the menu.")
            continue
        try:
            action(config, db_path)
        except ConfigError as exc:
            print(f"\nCONFIG ERROR: {exc}")
        except KeyboardInterrupt:
            print("\n(back to the menu)")
        except Exception as exc:
            print(f"\nSomething failed: {exc}")
