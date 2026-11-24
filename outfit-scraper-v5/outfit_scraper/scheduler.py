"""Background periodic collection for `serve --every N`.

While the viewer serves the API, this thread re-scrapes all active stores every N hours
(FR-35 / US-72) and refreshes the JSON snapshot after each pass, so the front's fallback
data stays fresh without anyone running commands by hand.
"""
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_SNAPSHOT = Path(__file__).resolve().parents[2] / "outfit-builder" / "public" / "catalog-snapshot.json"


def _log(msg):
    print(f"[scheduler] {msg}", flush=True)


def _run_pass(db_path, settings, snapshot_path, max_products=None):
    from . import db
    from .runner import run_all
    from .snapshot import export

    conn = db.connect(db_path)
    try:
        results = run_all(conn, settings, max_products=max_products,
                          progress=lambda s: _log(f"collecting {s['name']}…"))
        for r in results:
            _log(f"  {r['store']}: {r['status']} — {r['saved']} saved of {r['found']}")
        if snapshot_path:
            try:
                count, path = export(conn, snapshot_path)
                _log(f"snapshot refreshed: {path} ({count} products)")
            except Exception as exc:            # a broken snapshot must never kill the API
                _log(f"snapshot refresh failed: {exc}")
    finally:
        conn.close()


class BackgroundCollector:
    """Collects immediately at start, then every `every_hours`; stoppable via stop()."""

    def __init__(self, db_path, settings, every_hours, snapshot_path=None, max_products=None):
        self.db_path, self.settings, self.every = db_path, settings, every_hours
        self.snapshot, self.max_products = snapshot_path, max_products
        self._stop = threading.Event()
        self.thread = threading.Thread(target=self._loop, daemon=True)

    def _loop(self):
        _run_pass(self.db_path, self.settings, self.snapshot, self.max_products)
        while not self._stop.wait(self.every * 3600):
            _run_pass(self.db_path, self.settings, self.snapshot)
        _log("background collection stopped")

    def stop(self):
        self._stop.set()

    def start(self):
        self.thread.start()
        return self


def start_background_collection(db_path, settings, every_hours, snapshot_arg, max_products=None):
    """Resolve the snapshot path and start the collector thread."""
    if snapshot_arg is None and DEFAULT_SNAPSHOT.exists():
        path = str(DEFAULT_SNAPSHOT)
    else:
        path = snapshot_arg
    _log(f"periodic collection every {every_hours} h"
         + (f"; snapshot → {path}" if path else "")
         + (f"; max {max_products} products per store" if max_products else "")
         + f" (started {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')})")
    return BackgroundCollector(db_path, settings, every_hours, path, max_products).start()
