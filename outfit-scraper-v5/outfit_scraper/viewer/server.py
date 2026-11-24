"""Small local web viewer: shows stores, scraping logs and the collected products. Uses only the standard library."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .. import db
from ..runner import run_all

INDEX = Path(__file__).with_name("index.html")


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class Viewer:
    def __init__(self, db_path, settings):
        self.db_path, self.settings = db_path, settings
        self.lock = threading.Lock()
        self.state = {"running": False, "current": None, "last": []}

    def start_run(self, store_id):
        with self.lock:
            if self.state["running"]:
                return False
            self.state.update(running=True, current=store_id or "all active stores", last=[])
        threading.Thread(target=self._run, args=(store_id,), daemon=True).start()
        return True

    def _run(self, store_id):
        conn = db.connect(self.db_path)
        try:
            results = run_all(conn, self.settings, store_id=store_id,
                              progress=lambda s: self.state.update(current=s["name"]))
        except Exception as exc:
            results = [{"store": store_id or "-", "status": "failed", "errors": [str(exc)]}]
        finally:
            conn.close()
        with self.lock:
            self.state.update(running=False, current=None, last=results)


def make_handler(viewer):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _json(self, data, status=200):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            # the React front (vite dev server, another port) also consumes this API
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            url = urlparse(self.path)
            qs = {k: v[0] for k, v in parse_qs(url.query).items()}
            if url.path == "/":
                body = INDEX.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if url.path == "/api/run-status":
                return self._json(viewer.state)
            conn = db.connect(viewer.db_path)
            try:
                if url.path == "/api/stats":
                    return self._json(db.stats(conn))
                if url.path == "/api/stores":
                    return self._json(db.stores_status(conn))
                if url.path == "/api/logs":
                    return self._json(db.logs(conn, int(qs.get("limit", 30))))
                if url.path == "/api/products":
                    return self._json(db.list_products(
                        conn, q=qs.get("q", ""), store=qs.get("store", ""), category=qs.get("category", ""),
                        subcategory=qs.get("subcategory", ""), color=qs.get("color", ""), size=qs.get("size", ""),
                        min_price=_num(qs.get("min_price")), max_price=_num(qs.get("max_price")),
                        sort=qs.get("sort", "updated"), limit=min(int(qs.get("limit", 60)), 200),
                        offset=int(qs.get("offset", 0)),
                        single_garment=qs.get("single_garment", "") in ("1", "true", "yes")))
            finally:
                conn.close()
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            if urlparse(self.path).path != "/api/run":
                return self._json({"error": "not found"}, 404)
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            started = viewer.start_run(payload.get("store"))
            self._json({"started": started}, 200 if started else 409)

    return Handler


def start(db_path, settings, port=8000, host="127.0.0.1"):
    """Start the viewer in a background thread. Returns (server, url). Tries the next ports if one is busy."""
    for candidate in range(port, port + 20):
        try:
            server = ThreadingHTTPServer((host, candidate), make_handler(Viewer(db_path, settings)))
            break
        except OSError:
            continue
    else:
        raise OSError(f"no free port between {port} and {port + 19}")
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://{host}:{server.server_address[1]}"


def serve(db_path, settings, port=8000, host="127.0.0.1"):
    server, url = start(db_path, settings, port, host)
    print(f"Viewer running at {url}  (Ctrl+C to stop)")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
