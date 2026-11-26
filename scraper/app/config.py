"""Configuración del servicio leída de variables de entorno.

Los valores por defecto están pensados para que `POST /scrape` responda antes de que
el backend corte la espera (`SCRAPER_TIMEOUT_MS`, 15 s por defecto): el scraper trabaja
con un presupuesto de tiempo menor y, si se le acaba, devuelve lo que alcanzó a leer.
"""
import os
from dataclasses import dataclass

DEFAULT_BACKEND_TIMEOUT_MS = 15_000
DEFAULT_USER_AGENT = "OutfitFinderBot/1.0 (university project)"


def budget_from_backend_timeout(timeout_ms):
    """Presupuesto (segundos) que deja margen para normalizar, serializar y viajar por la red:
    el 20 % del timeout del backend, mínimo 2 s. 15 000 ms -> 12 s."""
    margin_ms = max(2_000, timeout_ms * 0.2)
    return max(1.0, (timeout_ms - margin_ms) / 1000)


def _number(env, name, default, cast=float, minimum=None):
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = cast(raw)
    except ValueError:
        return default
    if minimum is not None and value < minimum:
        return default
    return value


def _flag(env, name, default):
    raw = (env.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "si", "sí", "on")


@dataclass(frozen=True)
class Settings:
    user_agent: str = DEFAULT_USER_AGENT
    delay_seconds: float = 1.0          # espera mínima entre dos peticiones al mismo host
    jitter_seconds: float = 0.3         # espera aleatoria extra (0..jitter)
    retries: int = 3                    # reintentos ante 429 / 5xx / error de red
    max_failures: int = 5               # circuit breaker: fallos seguidos antes de abandonar la tienda
    request_timeout: float = 8.0        # timeout de cada petición (nunca supera el presupuesto restante)
    respect_robots: bool = True
    time_budget_seconds: float = budget_from_backend_timeout(DEFAULT_BACKEND_TIMEOUT_MS)
    max_products: int = 150             # productos devueltos por scraping (ya filtrados)
    single_garment: bool = True         # descarta packs/kits de varias prendas
    image_analysis: bool = False        # mirar píxeles (Pillow) para elegir la foto de la prenda sola
    image_candidates: int = 3           # imágenes por producto que se descargan para analizarlas
    image_delay_seconds: float = 0.2
    detect_cache_seconds: float = 6 * 3600

    @classmethod
    def from_env(cls, env=None):
        env = os.environ if env is None else env
        budget_ms = _number(env, "SCRAPER_TIME_BUDGET_MS", None, int, 1)
        if budget_ms is None:
            backend_ms = _number(env, "SCRAPER_TIMEOUT_MS", DEFAULT_BACKEND_TIMEOUT_MS, int, 1)
            budget = budget_from_backend_timeout(backend_ms)
        else:
            budget = budget_ms / 1000
        return cls(
            user_agent=(env.get("SCRAPER_USER_AGENT") or "").strip() or DEFAULT_USER_AGENT,
            delay_seconds=_number(env, "SCRAPER_DELAY_SECONDS", cls.delay_seconds, float, 0),
            jitter_seconds=_number(env, "SCRAPER_JITTER_SECONDS", cls.jitter_seconds, float, 0),
            retries=_number(env, "SCRAPER_RETRIES", cls.retries, int, 0),
            max_failures=_number(env, "SCRAPER_MAX_FAILURES", cls.max_failures, int, 1),
            request_timeout=_number(env, "SCRAPER_REQUEST_TIMEOUT_SECONDS", cls.request_timeout, float, 0.5),
            respect_robots=_flag(env, "SCRAPER_RESPECT_ROBOTS", cls.respect_robots),
            time_budget_seconds=budget,
            max_products=_number(env, "SCRAPER_MAX_PRODUCTS", cls.max_products, int, 1),
            single_garment=_flag(env, "SCRAPER_SINGLE_GARMENT", cls.single_garment),
            image_analysis=_flag(env, "SCRAPER_IMAGE_ANALYSIS", cls.image_analysis),
            image_candidates=_number(env, "SCRAPER_IMAGE_CANDIDATES", cls.image_candidates, int, 1),
            image_delay_seconds=_number(env, "SCRAPER_IMAGE_DELAY_SECONDS", cls.image_delay_seconds, float, 0),
            detect_cache_seconds=_number(env, "SCRAPER_DETECT_CACHE_SECONDS", cls.detect_cache_seconds, float, 0),
        )
