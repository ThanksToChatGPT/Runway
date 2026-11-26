"""Para tiendas sin un endpoint JSON público: lee las páginas de listado con selectores CSS.

Configuración (campo `config` de la petición, junto con `"platform": "html"`):
{
  "list_urls": [{"url": "https://shop.com/hombre/camisetas?page={page}", "category": "camiseta"}],
  "max_pages": 5,
  "selectors": {"item": ".product-card", "name": ".title", "price": ".price",
                "link": "a@href", "image": "img@src", "brand": ".brand"}
}
"css" lee el texto de un elemento y "css@atributo" lee un atributo. Por seguridad, las páginas de listado
deben estar en el mismo host que `base_url`.
"""
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.extractors.base import BaseExtractor, ConfigError
from app.models import RawProduct


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


class HtmlSelectorsExtractor(BaseExtractor):
    platform = "html"

    def _entries(self):
        sel = self.config.get("selectors")
        entries = self.config.get("list_urls")
        if not isinstance(sel, dict) or not sel.get("item") or not entries:
            raise ConfigError("las tiendas html necesitan 'list_urls' y 'selectors' (con 'item') en su config")
        host = urlparse(self.base_url).netloc
        result = []
        for entry in entries if isinstance(entries, list) else [entries]:
            entry = {"url": entry} if isinstance(entry, str) else entry
            if not isinstance(entry, dict) or not entry.get("url"):
                raise ConfigError("cada elemento de 'list_urls' necesita 'url'")
            url = urljoin(self.base_url + "/", entry["url"])
            if urlparse(url).netloc != host:
                raise ConfigError(f"'{entry['url']}' no está en el host de la tienda ({host})")
            result.append({**entry, "url": url})
        return sel, result

    def fetch(self):
        sel, entries = self._entries()
        max_pages = self._int_config("max_pages", 50)
        seen, count = set(), 0
        for entry in entries:
            for page in range(1, max_pages + 1):
                url = entry["url"].replace("{page}", str(page))
                soup = BeautifulSoup(self.client.get(url).text, "html.parser")
                new_cards = 0
                for card in soup.select(sel["item"]):
                    link = urljoin(url, _read(card, sel.get("link", "a@href")))
                    if not link or link in seen:
                        continue
                    seen.add(link)
                    new_cards += 1
                    image = _read(card, sel.get("image"))
                    yield RawProduct(
                        external_id=re.sub(r"\W+", "-", urlparse(link).path).strip("-"),
                        name=_read(card, sel.get("name")), url=link,
                        price=_read(card, sel.get("price")), brand=_read(card, sel.get("brand")),
                        category=entry.get("category", ""),
                        images=[urljoin(url, image)] if image else [])
                    count += 1
                    if self.max_products and count >= self.max_products:
                        return
                if new_cards == 0 or "{page}" not in entry["url"]:   # página vacía o repetida: se para
                    break
