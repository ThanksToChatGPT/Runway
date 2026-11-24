from .html_selectors import HtmlSelectorsAdapter
from .shopify import ShopifyAdapter
from .vtex import VtexAdapter
from .vtex_is import VtexIntelligentSearchAdapter

ADAPTERS = {"shopify": ShopifyAdapter, "vtex": VtexAdapter, "vtex_is": VtexIntelligentSearchAdapter,
            "html": HtmlSelectorsAdapter}


def get_adapter(store, client, max_products=None):
    try:
        cls = ADAPTERS[store["platform"]]
    except KeyError:
        raise ValueError(f"unknown platform {store['platform']!r}; use one of {sorted(ADAPTERS)}")
    return cls(store, client, max_products)
