"""Las tiendas Shopify publican su catálogo en /products.json (no dicen cuántas unidades quedan)."""
from app.extractors.base import BaseExtractor
from app.models import RawProduct

SIZE_WORDS = ("talla", "size", "tamano", "tamaño")
COLOR_WORDS = ("color", "colour")


def _absolute(url):
    return "https:" + url if url.startswith("//") else url


class ShopifyExtractor(BaseExtractor):
    platform = "shopify"

    def fetch(self):
        count, page = 0, 1
        max_pages = self._int_config("max_pages", 400)       # 400 páginas x 250 = 100 000 productos
        while page <= max_pages:
            data = self.client.get_json(f"{self.base_url}/products.json", params={"limit": 250, "page": page})
            products = data.get("products", []) if isinstance(data, dict) else []
            if not products:
                return
            for p in products:
                raw = self._safe_parse(p)
                if raw is None:
                    continue
                yield raw
                count += 1
                if self.max_products and count >= self.max_products:
                    return
            page += 1

    def _parse(self, p):
        options = [(o.get("name", "").lower(), o.get("position", i + 1)) for i, o in enumerate(p.get("options", []))]
        size_pos = next((pos for name, pos in options if any(w in name for w in SIZE_WORDS)), None)
        color_pos = next((pos for name, pos in options if any(w in name for w in COLOR_WORDS)), None)
        sizes, colors, prices = {}, [], []
        for v in p.get("variants", []):
            if v.get("price") not in (None, ""):
                prices.append(float(v["price"]))
            if size_pos:
                label = v.get(f"option{size_pos}")
                if label:
                    sizes[label] = sizes.get(label, False) or bool(v.get("available", True))
            if color_pos:
                color = v.get(f"option{color_pos}")
                if color and color not in colors:
                    colors.append(color)
        tags = p.get("tags", [])
        tags = tags if isinstance(tags, str) else ", ".join(tags)
        images, meta = [], {}
        for i in p.get("images", []):
            if i.get("src"):
                src = _absolute(i["src"])
                images.append(src)
                meta[src] = i.get("alt") or ""
        # Shopify no tiene "cuántas unidades quedan" ni marca de kit: el título y los tags delatan los packs
        kit_word = ("pack" in p.get("title", "").lower() or "kit" in tags.lower()
                    or "pack" in str(p.get("product_type", "")).lower())
        return RawProduct(
            external_id=str(p.get("id")), name=p.get("title", ""),
            url=f"{self.base_url}/products/{p.get('handle', '')}",
            price=min(prices) if prices else None, brand=p.get("vendor", ""),
            category=f"{p.get('product_type', '')} {tags}", description=p.get("body_html", "") or "",
            colors=colors, sizes=list(sizes.items()), images=images, image_meta=meta,
            is_kit=kit_word)
