"""Cliente HTTP que se porta bien con las tiendas: robots.txt, esperas entre peticiones,
reintentos con backoff ante 429/5xx, acepta 206 (VTEX), circuit breaker y presupuesto de tiempo."""
import random
import time
import urllib.robotparser
from urllib.parse import urlparse

import httpx

MIN_REQUEST_WINDOW = 0.25        # segundos mínimos que deben quedar para empezar una petición
OK_STATUSES = (200, 206)         # VTEX responde 206 Partial Content a las consultas por rango (_from/_to)


class ScraperError(Exception):
    """Error al leer una tienda."""


class RobotsDisallowed(ScraperError):
    pass


class CircuitOpen(ScraperError):
    pass


class BudgetExhausted(ScraperError):
    """Se acabó el presupuesto de tiempo de esta petición al servicio."""


class FetchError(ScraperError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class PoliteClient:
    def __init__(self, user_agent, delay=1.0, jitter=0.3, retries=3, timeout=8.0, respect_robots=True,
                 max_failures=5, deadline=None, transport=None, clock=time.monotonic, sleep=time.sleep):
        self.user_agent = user_agent
        self.delay = delay
        self.jitter = jitter
        self.retries = retries
        self.timeout = timeout
        self.respect_robots = respect_robots
        self.max_failures = max_failures
        self.deadline = deadline             # instante (según `clock`) en que hay que dejar de pedir
        self.clock = clock
        self._sleep = sleep
        self.failures = 0                    # peticiones fallidas seguidas
        self.requests_made = 0
        self._last_request = {}              # host -> instante de la última petición
        self._robots = {}                    # origen -> RobotFileParser o None (todo permitido)
        self.http = httpx.Client(
            headers={"User-Agent": user_agent, "Accept-Language": "es-CO,es;q=0.9,en;q=0.5"},
            follow_redirects=True, timeout=timeout, transport=transport)

    def close(self):
        self.http.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # ---- presupuesto de tiempo ----
    def remaining(self):
        return None if self.deadline is None else self.deadline - self.clock()

    def _check_budget(self, needed=0.0):
        left = self.remaining()
        if left is not None and left - needed < MIN_REQUEST_WINDOW:
            raise BudgetExhausted("se agotó el tiempo disponible para esta tienda")

    def _timeout(self):
        left = self.remaining()
        return self.timeout if left is None else max(0.1, min(self.timeout, left))

    def pause(self, seconds):
        """Duerme sin pasarse del presupuesto (si no alcanza, lanza BudgetExhausted)."""
        if seconds <= 0:
            return
        self._check_budget(seconds)
        self._sleep(seconds)

    # ---- robots.txt ----
    def _load_robots(self, base):
        self._check_budget()
        try:
            r = self.http.get(base + "/robots.txt", timeout=self._timeout())
        except httpx.HTTPError as exc:
            raise RobotsDisallowed(f"no se pudo leer robots.txt: {exc}") from exc
        if 400 <= r.status_code < 500:
            return None                      # sin robots.txt: todo permitido
        if r.status_code != 200:
            raise RobotsDisallowed(f"robots.txt respondió {r.status_code}")
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

    # ---- peticiones ----
    def _wait(self, host):
        last = self._last_request.get(host)
        if last is not None:
            wait = self.delay + random.uniform(0, self.jitter) - (self.clock() - last)
            self.pause(wait)
        self._check_budget()
        self._last_request[host] = self.clock()

    def get(self, url, params=None):
        if self.failures >= self.max_failures:
            raise CircuitOpen(f"{self.failures} peticiones fallidas seguidas; se abandona esta tienda")
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt no permite {url}")
        host = urlparse(url).netloc
        last_error = None
        for attempt in range(self.retries + 1):
            self._wait(host)
            self.requests_made += 1
            try:
                r = self.http.get(url, params=params, timeout=self._timeout())
            except httpx.HTTPError as exc:
                last_error = exc
            else:
                if r.status_code in OK_STATUSES:
                    self.failures = 0
                    return r
                if r.status_code == 429 or r.status_code >= 500:
                    last_error = f"HTTP {r.status_code}"
                    if attempt < self.retries:
                        retry_after = r.headers.get("Retry-After", "")
                        extra = float(retry_after) if retry_after.isdigit() else 0
                        self.pause(max(extra, self.delay * (2 ** attempt)))
                    continue
                self.failures += 1           # otros 4xx: no se reintenta
                raise FetchError(f"HTTP {r.status_code} for {url}", r.status_code)
            if attempt < self.retries:
                self.pause(self.delay * (2 ** attempt))
        self.failures += 1
        raise FetchError(f"giving up on {url}: {last_error}")

    def get_json(self, url, params=None):
        r = self.get(url, params=params)
        try:
            return r.json()
        except ValueError as exc:
            raise FetchError(f"respuesta no JSON en {url}") from exc

    def fetch_any(self, url, params=None):
        """Una petición educada que devuelve la respuesta sea cual sea su estado (la usa la detección).
        Respeta robots.txt, la espera entre peticiones y el presupuesto. Lanza RobotsDisallowed,
        BudgetExhausted o un `httpx.HTTPError`."""
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt no permite {url}")
        self._wait(urlparse(url).netloc)
        self.requests_made += 1
        return self.http.get(url, params=params, timeout=self._timeout())

    def fetch_bytes(self, url, max_bytes=3_000_000):
        """Descarga una imagen (solo en memoria) o devuelve None si falla, no es 200 o pesa demasiado."""
        try:
            if not self.allowed(url):
                return None
            self._wait(urlparse(url).netloc)
            self.requests_made += 1
            with self.http.stream("GET", url, timeout=self._timeout()) as r:
                if r.status_code != 200:
                    return None
                data = bytearray()
                for chunk in r.iter_bytes():
                    data += chunk
                    if len(data) > max_bytes:
                        return None
                return bytes(data)
        except (ScraperError, httpx.HTTPError):
            return None
