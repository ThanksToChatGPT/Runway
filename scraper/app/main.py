from functools import lru_cache
from typing import Annotated, Any, Literal, Optional
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException
from pydantic import AfterValidator, BaseModel, Field

from app import __version__
from app.config import Settings
from app.detect import DetectionCache
from app.extractors import PLATFORMS
from app.service import Runtime, ScrapeFailed, detect_store, scrape_store

app = FastAPI(title="Outfit Builder Scraper Service", version=__version__)


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()


@lru_cache
def get_runtime() -> Runtime:
    return Runtime(cache=DetectionCache(ttl_seconds=get_settings().detect_cache_seconds))


def _http_url(value: str) -> str:
    value = value.strip()
    parts = urlparse(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("debe ser una URL http(s) absoluta")
    return value


HttpUrlText = Annotated[str, AfterValidator(_http_url)]


class ScrapeRequest(BaseModel):
    """Contrato que envía `HttpScraperAdapter`: `{ store_id, slug, base_url }`. El resto es opcional."""
    store_id: str
    slug: str
    base_url: HttpUrlText
    platform: Optional[Literal[PLATFORMS]] = None      # sin valor: se detecta desde base_url
    config: dict[str, Any] = Field(default_factory=dict)
    max_products: Optional[int] = Field(default=None, ge=1, le=2000)


class DetectRequest(BaseModel):
    base_url: HttpUrlText
    html: Optional[str] = Field(default=None, max_length=5_000_000)   # HTML guardado desde el navegador
    grep: list[str] = Field(default_factory=list, max_length=20)
    probe_all: bool = False
    sample: int = Field(default=20, ge=0, le=100)                       # productos de muestra (packs, categorías)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scrape")
def scrape(payload: ScrapeRequest, settings: Settings = Depends(get_settings),
           runtime: Runtime = Depends(get_runtime)):
    try:
        return scrape_store(store_id=payload.store_id, slug=payload.slug, base_url=payload.base_url,
                            settings=settings, runtime=runtime, platform=payload.platform,
                            config=payload.config, max_products=payload.max_products)
    except ScrapeFailed as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail()) from exc


@app.post("/detect")
def detect(payload: DetectRequest, settings: Settings = Depends(get_settings),
           runtime: Runtime = Depends(get_runtime)):
    return detect_store(base_url=payload.base_url, settings=settings, runtime=runtime, html=payload.html,
                        grep=payload.grep, probe_all=payload.probe_all, sample=payload.sample)
