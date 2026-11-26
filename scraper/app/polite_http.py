"""HTTP client that behaves well with stores: robots.txt, delays, retries and a circuit breaker."""
import random
import time
import urllib.robotparser
from urllib.parse import urlparse

import requests


class RobotsDisallowed(Exception):
    pass


class CircuitOpen(Exception):
    pass


class PoliteClient:
    def __init__(self, user_agent, delay=2.0, jitter=0.5, retries=3, timeout=20,
                 respect_robots=True, max_failures=5):
        self.user_agent = user_agent
        self.delay = delay
        self.jitter = jitter
        self.retries = retries
        self.timeout = timeout
        self.respect_robots = respect_robots
        self.max_failures = max_failures
        self.failures = 0                    # consecutive failed requests
        self.requests_made = 0
        self._last_request = {}              # host -> time of the last request
        self._robots = {}                    # host -> RobotFileParser or None (allow all)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept-Language": "es-CO,es;q=0.9,en;q=0.5",
        })

    # ---- robots.txt ----
    def _load_robots(self, base):
        try:
            r = self.session.get(base + "/robots.txt", timeout=self.timeout)
        except requests.RequestException as exc:
            raise RobotsDisallowed(f"could not read robots.txt: {exc}")
        if 400 <= r.status_code < 500:
            return None                      # no robots.txt: everything is allowed
        if r.status_code != 200:
            raise RobotsDisallowed(f"robots.txt answered {r.status_code}")
        parser = urllib.robotparser.RobotFileParser()
        parser.parse(r.text.splitlines())
        return parser

    def allowed(self, url):
        if not self.respect_robots:
            return True
        parts = urlparse(url)
        base = f"{parts.scheme}://{parts.netloc}"
        if base not in self._robots:
            self._robots[base] = self._load_robots(base)
        parser = self._robots[base]
        return True if parser is None else parser.can_fetch(self.user_agent, url)

    # ---- requests ----
    def _wait(self, host):
        last = self._last_request.get(host)
        if last is not None:
            wait = self.delay + random.uniform(0, self.jitter) - (time.monotonic() - last)
            if wait > 0:
                time.sleep(wait)
        self._last_request[host] = time.monotonic()

    def get(self, url, params=None):
        if self.failures >= self.max_failures:
            raise CircuitOpen(f"{self.failures} failed requests in a row; stopping this store")
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt does not allow {url}")
        host = urlparse(url).netloc
        last_error = None
        for attempt in range(self.retries + 1):
            self._wait(host)
            self.requests_made += 1
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = exc
            else:
                if r.status_code in (200, 206):
                    self.failures = 0
                    return r
                if r.status_code == 429 or r.status_code >= 500:
                    last_error = RuntimeError(f"HTTP {r.status_code} for {url}")
                    retry_after = r.headers.get("Retry-After", "")
                    extra = float(retry_after) if retry_after.isdigit() else 0
                    time.sleep(max(extra, self.delay * (2 ** attempt)))
                    continue
                self.failures += 1           # 4xx other than 429: do not retry
                raise RuntimeError(f"HTTP {r.status_code} for {url}")
            time.sleep(self.delay * (2 ** attempt))
        self.failures += 1
        raise RuntimeError(f"giving up on {url}: {last_error}")

    def fetch_any(self, url, params=None):
        """One polite request that returns the response whatever its status (used by the `detect` command).
        Still checks robots.txt and waits between requests. Raises RobotsDisallowed or a requests exception."""
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt does not allow {url}")
        self._wait(urlparse(url).netloc)
        self.requests_made += 1
        return self.session.get(url, params=params, timeout=self.timeout)

    def get_json(self, url, params=None):
        return self.get(url, params=params).json()


def make_client_from(settings):
    return PoliteClient(settings["user_agent"], delay=settings["delay_seconds"], retries=settings["retries"],
                        respect_robots=settings["respect_robots"], max_failures=settings["max_failures"])
