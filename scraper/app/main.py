from fastapi import FastAPI
from pydantic import BaseModel

from app.extractors.mock_store import MockStoreExtractor
from app.normalizer import normalize_product

app = FastAPI(title="Outfit Builder Scraper Service", version="0.1.0")

EXTRACTORS = {
    "mock": MockStoreExtractor(),
}


class ScrapeRequest(BaseModel):
    store_id: str
    slug: str
    base_url: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scrape")
def scrape_store(payload: ScrapeRequest):
    extractor = EXTRACTORS.get(payload.slug, EXTRACTORS["mock"])
    raw_items = extractor.extract(payload.base_url)
    normalized = [normalize_product(item) for item in raw_items]
    return {
        "store_id": payload.store_id,
        "slug": payload.slug,
        "count": len(normalized),
        "products": normalized,
    }
