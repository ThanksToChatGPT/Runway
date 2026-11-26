"""Orquesta un scraping: plataforma -> extractor -> normalizador -> filtros -> selector de imágenes.

Todo ocurre dentro de un presupuesto de tiempo (`Settings.time_budget_seconds`): si se acaba, se devuelve
lo que se alcanzó a leer (`stats.stop_reason = "time_budget"`) para responder antes de que el backend
corte la espera.
"""
import time
from dataclasses import dataclass, field
from typing import Callable
from urllib.parse import urlparse

from app import image_picker
from app.detect import DetectionCache, detect_platform, split_base
from app.extractors import ConfigError, get_extractor
from app.normalizer import MVP_CATEGORIES, normalize
from app.polite_http import BudgetExhausted, CircuitOpen, FetchError, PoliteClient, RobotsDisallowed

IMAGE_BUDGET_RESERVE = 0.4      # el análisis de imágenes se detiene cuando queda menos del 40 % del presupuesto
MAX_ERRORS = 10


class ScrapeFailed(Exception):
    """El scraping no produjo productos. `status` es el código HTTP que devuelve el servicio."""

    def __init__(self, status, code, message, **extra):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra

    def detail(self):
        return {"code": self.code, "message": self.message, **self.extra}


@dataclass
class Runtime:
    """Dependencias de ejecución; las pruebas las reemplazan para trabajar sin red ni esperas reales."""
    transport: object = None                       # httpx.BaseTransport (None = red real)
    clock: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    cache: DetectionCache = field(default_factory=DetectionCache)


def make_client(settings, runtime, deadline, delay=None, retries=None, max_failures=None):
    return PoliteClient(
        settings.user_agent,
        delay=settings.delay_seconds if delay is None else delay,
        jitter=settings.jitter_seconds,
        retries=settings.retries if retries is None else retries,
        timeout=settings.request_timeout,
        respect_robots=settings.respect_robots,
        max_failures=settings.max_failures if max_failures is None else max_failures,
        deadline=deadline, transport=runtime.transport, clock=runtime.clock, sleep=runtime.sleep)


def _as_bool(value, default):
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "si", "sí", "on")
    return bool(value)


def is_mock_store(slug, base_url):
    host = (urlparse(base_url).hostname or "").lower()
    return slug == "mock" or slug.startswith("mock-") or host == "mock" or host.endswith(".mock")


def resolve_platform(slug, base, platform, config, client, cache):
    """(plataforma, config, origen) con origen en request | mock | cache | detected."""
    if platform:
        return platform, config, "request"
    if is_mock_store(slug, base):
        return "mock", config, "mock"
    cached = cache.get(base)
    if cached:
        return cached["platform"], {**cached["config"], **config}, "cache"
    report = detect_platform(base, client, stop_at_first=True)
    if report["platform"]:
        cache.put(base, report["platform"], report["config"])
        return report["platform"], {**report["config"], **config}, "detected"
    if report.get("timed_out"):
        raise ScrapeFailed(504, "timeout", report["message"])
    if report["robots"]["allowed"] is False and not any(p["status"] for p in report["probes"]):
        raise ScrapeFailed(502, "robots_disallowed", report["message"])
    raise ScrapeFailed(422, "unsupported_platform", report["message"],
                       fingerprints=report["fingerprints"], protection=report["protection"],
                       home_status=report["home_status"])


def _image_fetcher(settings, runtime, deadline):
    """Función url -> bytes|None para mirar píxeles, o (None, None) si el análisis está apagado."""
    if not settings.image_analysis or not image_picker.HAVE_PIL:
        return None, None
    client = make_client(settings, runtime, deadline, delay=settings.image_delay_seconds, retries=1,
                         max_failures=50)
    reserve = settings.time_budget_seconds * IMAGE_BUDGET_RESERVE

    def fetch(url):
        left = client.remaining()
        if left is not None and left < reserve:
            return None
        return client.fetch_bytes(url)
    return fetch, client


def scrape_store(*, store_id, slug, base_url, settings, runtime, platform=None, config=None, max_products=None):
    started = runtime.clock()
    deadline = started + settings.time_budget_seconds
    _, base = split_base(base_url)
    config = dict(config or {})
    limit = max_products or settings.max_products
    single = _as_bool(config.get("single_garment"), settings.single_garment)
    stats = {"found": 0, "returned": 0, "skipped_packs": 0, "skipped_non_garment": 0, "skipped_invalid": 0}
    products, errors = [], []
    stop_reason, fatal, source = "complete", None, None
    client = make_client(settings, runtime, deadline)
    fetch_image, image_client = None, None
    try:
        try:
            platform, config, source = resolve_platform(slug, base, platform, config, client, runtime.cache)
        except BudgetExhausted as exc:
            raise ScrapeFailed(504, "timeout",
                               "Se acabó el tiempo disponible antes de identificar la plataforma.") from exc
        if platform != "mock":
            fetch_image, image_client = _image_fetcher(settings, runtime, deadline)
        try:
            extractor = get_extractor(platform, base, client, config)
            for raw in extractor.fetch():
                stats["found"] += 1
                try:
                    product, reason = normalize(raw)
                    if product is None:
                        stats["skipped_invalid"] += 1
                        errors.append(f"omitido {raw.url or raw.external_id}: {reason}")
                        continue
                    if single and product.pack_size > 1:          # un pack de N prendas no es "una prenda"
                        stats["skipped_packs"] += 1
                        continue
                    if product.category not in MVP_CATEGORIES:  # accesorios, medias, utilitarios...
                        stats["skipped_non_garment"] += 1
                        continue
                    product.images, _ = image_picker.pick_images(
                        product.images, raw.image_meta, fetch_image, settings.image_candidates)
                    products.append(product.to_contract())
                except Exception as exc:                       # un producto malo no detiene la tienda
                    errors.append(f"error en {raw.url or raw.external_id}: {exc}")
                    continue
                if len(products) >= limit:
                    stop_reason = "max_products"
                    break
            errors.extend(extractor.parse_errors)
        except ConfigError as exc:
            raise ScrapeFailed(422, "invalid_config", str(exc)) from exc
        except BudgetExhausted:
            stop_reason = "time_budget"
        except (RobotsDisallowed, CircuitOpen, FetchError) as exc:
            stop_reason, fatal = "error", exc
            errors.append(f"detenido: {exc}")
    finally:
        client.close()
        if image_client:
            image_client.close()

    requests = client.requests_made + (image_client.requests_made if image_client else 0)
    if not products:
        if fatal is not None or stats["found"] == 0:
            if source in ("cache", "detected"):
                runtime.cache.invalidate(base)          # la próxima vez se vuelve a detectar la plataforma
        if isinstance(fatal, RobotsDisallowed):
            raise ScrapeFailed(502, "robots_disallowed", str(fatal), platform=platform)
        if fatal is not None:
            raise ScrapeFailed(502, "store_unavailable", str(fatal), platform=platform)
        if stop_reason == "time_budget":
            raise ScrapeFailed(504, "timeout", "Se acabó el tiempo disponible sin leer productos.", platform=platform)
        if stats["found"] == 0:
            raise ScrapeFailed(502, "no_products", "La tienda no devolvió productos.", platform=platform)

    stats.update(returned=len(products), requests=requests, stop_reason=stop_reason, platform_source=source,
                 elapsed_ms=int((runtime.clock() - started) * 1000))
    return {
        "store_id": store_id,
        "slug": slug,
        "platform": platform,
        "status": "partial" if stop_reason in ("error", "time_budget") else "success",
        "count": len(products),
        "products": products,
        "stats": stats,
        "errors": errors[:MAX_ERRORS],
    }


def detect_store(*, base_url, settings, runtime, html=None, grep=(), probe_all=False, sample=0):
    started = runtime.clock()
    client = make_client(settings, runtime, started + settings.time_budget_seconds)
    try:
        report = detect_platform(base_url, client, html=html, grep_words=grep, probe_all=probe_all,
                                 sample_size=sample)
    finally:
        client.close()
    if report["platform"]:
        runtime.cache.put(report["base_url"], report["platform"], report["config"])
    report["requests"] = client.requests_made
    report["elapsed_ms"] = int((runtime.clock() - started) * 1000)
    return report
