from app.extractors.base import BaseExtractor, ConfigError
from app.extractors.html_selectors import HtmlSelectorsExtractor
from app.extractors.mock_store import MockStoreExtractor
from app.extractors.shopify import ShopifyExtractor
from app.extractors.vtex import VtexExtractor
from app.extractors.vtex_is import VtexIntelligentSearchExtractor

EXTRACTORS = {
    "shopify": ShopifyExtractor,
    "vtex": VtexExtractor,
    "vtex_is": VtexIntelligentSearchExtractor,
    "html": HtmlSelectorsExtractor,
    "mock": MockStoreExtractor,
}
PLATFORMS = tuple(EXTRACTORS)


def get_extractor(platform, base_url, client, config=None, max_products=None) -> BaseExtractor:
    try:
        cls = EXTRACTORS[platform]
    except KeyError:
        raise ConfigError(f"plataforma desconocida {platform!r}; usa una de {sorted(EXTRACTORS)}") from None
    return cls(base_url, client, config, max_products)
