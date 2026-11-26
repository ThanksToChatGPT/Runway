"""For stores without a public JSON endpoint: read the product list pages with CSS selectors.

Store config example:
{
  "list_urls": [{"url": "https://shop.com/hombre/camisetas?page={page}", "category": "camiseta"}],
  "max_pages": 5,
  "selectors": {"item": ".product-card", "name": ".title", "price": ".price",
                "link": "a@href", "image": "img@src", "brand": ".brand"}
}
Use "css" to read the text of an element and "css@attribute" to read an attribute.
"""
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..models import RawProduct
from .base import BaseAdapter


def _read(el, spec):
    if not spec:
        return ""
    css, _, attr = spec.partition("@")
    node = el if css in ("", ".", "self") else el.select_one(css)
    if node is None:
        return ""
    if attr:
        return (node.get(attr) or "").strip()
    return node.get_text(" ", strip=True)


class HtmlSelectorsAdapter(BaseAdapter):
    platform = "html"

    def fetch(self):
        sel = self.config.get("selectors")
        if not sel or not self.config.get("list_urls"):
            raise ValueError("html stores need 'list_urls' and 'selectors' in their config")
        seen, count = set(), 0
        for entry in self.config["list_urls"]:
            entry = {"url": entry} if isinstance(entry, str) else entry
            for page in range(1, int(self.config.get("max_pages", 50)) + 1):
                url = entry["url"].replace("{page}", str(page))
                soup = BeautifulSoup(self.client.get(url).text, "html.parser")
                cards = soup.select(sel["item"])
                new_cards = 0
                for card in cards:
                    link = urljoin(url, _read(card, sel.get("link", "a@href")))
                    if not link or link in seen:
                        continue
                    seen.add(link)
                    new_cards += 1
                    yield RawProduct(
                        external_id=re.sub(r"\W+", "-", urlparse(link).path).strip("-"),
                        name=_read(card, sel.get("name")), url=link,
                        price=_read(card, sel.get("price")), brand=_read(card, sel.get("brand")),
                        category=entry.get("category", ""),
                        images=[urljoin(url, _read(card, sel.get("image")))] if _read(card, sel.get("image")) else [])
                    count += 1
                    if self.max_products and count >= self.max_products:
                        return
                if new_cards == 0:        # empty page or a page we already read: stop
                    break
