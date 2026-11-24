import argparse
import sys

from . import db
from .checks import check_store
from .runner import DEFAULT_SETTINGS, ConfigError, load_config, run_all, schedule


def _sync_stores(conn, stores):
    for s in stores:
        db.upsert_store(conn, s)


def cmd_init(args, conn, settings, stores):
    _sync_stores(conn, stores)
    print(f"Database ready at {args.db} with {len(stores)} stores from {args.config}.")


def cmd_add(args, conn, settings, stores):
    from .menu import add_store_by_url
    conn.close()
    saved = add_store_by_url(args.config, args.db, args.url, args.name, interactive=False)
    return 0 if saved else 1


def cmd_detect(args, conn, settings, stores):
    from .detect import detect
    detect(args.url, settings, html_path=args.html, extra_grep=args.grep or (), probe_all=args.all)


def cmd_check(args, conn, settings, stores):
    """Test a store without saving anything: robots.txt, first page and a sample of clean products."""
    chosen = [s for s in stores if (args.store is None or s["id"] == args.store)]
    if not chosen:
        print("No store matches that id.")
        return 1
    return 0 if all([check_store(s, settings, args.limit) for s in chosen]) else 1


def cmd_run(args, conn, settings, stores):
    _sync_stores(conn, stores)
    for r in run_all(conn, settings, store_id=args.store, max_products=args.max,
                     progress=lambda s: print(f"Collecting {s['name']}…", flush=True)):
        print(f"  {r['store']}: {r['status']} — {r['saved']} saved of {r['found']} read ({r['requests']} requests)")
        for line in r["notes"] + r["errors"]:
            print("    ", line)


def cmd_schedule(args, conn, settings, stores):
    _sync_stores(conn, stores)
    print(f"Collecting every {args.every} hours. Ctrl+C to stop.")
    try:
        schedule(conn, settings, args.every, args.max)
    except KeyboardInterrupt:
        pass


def cmd_serve(args, conn, settings, stores):
    from .viewer.server import serve
    _sync_stores(conn, stores)
    conn.close()
    # --every N: while serving the API, re-scrape all active stores every N hours (FR-35/US-72)
    # and refresh the JSON snapshot after each run, so the front never serves stale data.
    every = getattr(args, "every", None)
    snapshot = getattr(args, "snapshot", None)
    background = None
    if every:
        from .scheduler import start_background_collection
        background = start_background_collection(args.db, settings, every, snapshot,
                                                  max_products=getattr(args, "max", None))
    try:
        serve(args.db, settings, args.port)
    finally:
        if background:
            background.stop()


def cmd_export(args, conn, settings, stores):
    from .snapshot import export
    _sync_stores(conn, stores)
    count, path = export(conn, args.out)
    print(f"Snapshot ready: {path} ({count} products, {len(stores)} stores).")


def cmd_demo(args, conn, settings, stores):
    from .demo_store import run_demo
    conn.close()
    run_demo(args.db, settings, args.port)


def cmd_menu(args, conn, settings, stores):
    from .menu import run_menu
    conn.close()
    return run_menu(args.db, args.config)


def main(argv=None):
    p = argparse.ArgumentParser(prog="outfit_scraper", description="Collect clothing products from online stores. "
                                "Run it without a command to open the menu.")
    p.add_argument("--db", default="outfit.db", help="SQLite file (default: outfit.db)")
    p.add_argument("--config", default="stores.json", help="stores and settings file (default: stores.json)")
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("menu", help="interactive menu (default)")
    sub.add_parser("init", help="create the database and load the stores")
    a = sub.add_parser("add", help="add a store from its URL (the platform is detected automatically)")
    a.add_argument("url"); a.add_argument("--name")
    t = sub.add_parser("detect", help="find the platform of a store and test its public APIs")
    t.add_argument("url"); t.add_argument("--html", help="analyse a saved HTML file instead of downloading the home page")
    t.add_argument("--grep", nargs="*", help="extra words to search for in the HTML")
    t.add_argument("--all", action="store_true", help="test every known API, not only the likely ones")
    c = sub.add_parser("check", help="test one or all stores without saving")
    c.add_argument("store", nargs="?"); c.add_argument("--limit", type=int, default=5)
    r = sub.add_parser("run", help="collect now")
    r.add_argument("--store"); r.add_argument("--max", type=int)
    s = sub.add_parser("schedule", help="collect every N hours")
    s.add_argument("--every", type=float, default=24); s.add_argument("--max", type=int)
    v = sub.add_parser("serve", help="open the viewer")
    v.add_argument("--port", type=int, default=8000)
    v.add_argument("--every", type=float, help="while serving, re-collect all active stores every N hours")
    v.add_argument("--max", type=int, help="with --every: max products to collect per store per pass")
    v.add_argument("--snapshot", help="refresh this JSON snapshot after every collection (default: ../outfit-builder/public/catalog-snapshot.json when it exists)")
    e = sub.add_parser("export", help="export the catalog to a JSON snapshot for the front")
    e.add_argument("--out", default="catalog-snapshot.json", help="output file (default: catalog-snapshot.json)")
    d = sub.add_parser("demo", help="fake stores + viewer to see it working")
    d.add_argument("--port", type=int, default=8000)
    args = p.parse_args(argv)
    try:
        settings, stores = load_config(args.config)
    except FileNotFoundError:
        settings, stores = dict(DEFAULT_SETTINGS), []
    except ConfigError as exc:
        print(f"CONFIG ERROR: {exc}")
        return 2
    conn = db.connect(args.db)
    handler = {"menu": cmd_menu, None: cmd_menu, "init": cmd_init, "add": cmd_add, "detect": cmd_detect,
               "check": cmd_check, "run": cmd_run, "schedule": cmd_schedule, "serve": cmd_serve,
               "demo": cmd_demo, "export": cmd_export}[args.cmd]
    return handler(args, conn, settings, stores) or 0


if __name__ == "__main__":
    sys.exit(main())
