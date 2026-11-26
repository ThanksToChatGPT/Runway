"""Las tiendas VTEX responden la API pública de búsqueda del catálogo. También dice cuántas unidades
quedan de cada SKU."""
from app.extractors.base import BaseExtractor
from app.models import RawProduct
from app.polite_http import BudgetExhausted, ScraperError

SIZE_KEYS = ("Talla", "Size", "talla", "size")
COLOR_KEYS = ("Color", "color")
MATERIAL_KEYS = ("Material", "material", "Composición tela 1")


def _first(d, keys):
    for k in keys:
        v = d.get(k)
        if v:
            return v if isinstance(v, list) else [v]
    return []


def _max_multiplier(items, start=1.0):
    multiplier = start
    for item in items:
        try:
            m = item.get("unitMultiplier")
            if m and float(m) > multiplier:
                multiplier = float(m)
        except (TypeError, ValueError):
            pass
    return multiplier


class VtexExtractor(BaseExtractor):
    platform = "vtex"
    PAGE = 50

    def fetch(self):
        seen, count = set(), 0
        extra = self.config.get("params") or {}        # p. ej. {"fq": "C:/12/"} para leer una categoría
        if not isinstance(extra, dict):
            extra = {}
        sources = [dict(extra)]
        self._capped = False
        for source in sources:
            for p in self._read(source, seen):
                raw = self._safe_parse(p)
                if raw is None:
                    continue
                yield raw
                count += 1
                if self.max_products and count >= self.max_products:
                    return
            # VTEX no sirve resultados más allá de una ventana (2500): al llegar a ella se lee categoría por categoría
            if source is sources[0] and self._capped and self.config.get("split_by_category", True):
                sources += [{**extra, "fq": f"C:{cid}"} for cid in self._category_ids()]

    def _read(self, extra, seen):
        window = self._int_config("window", 2500)
        page = self._int_config("page_size", self.PAGE)
        start = 0
        while start < window:
            to = min(start + page, window) - 1
            items = self.client.get_json(f"{self.base_url}/api/catalog_system/pub/products/search",
                                         params={"_from": start, "_to": to, **extra})
            if not items or not isinstance(items, list):
                return
            for p in items:
                pid = p.get("productId")
                if pid not in seen:
                    seen.add(pid)
                    yield p
            if len(items) < to - start + 1:
                return
            start += page
        self._capped = True

    def _category_ids(self):
        try:
            tree = self.client.get_json(f"{self.base_url}/api/catalog_system/pub/category/tree/3")
        except BudgetExhausted:
            raise
        except ScraperError:
            return []
        ids = []

        def walk(nodes):
            for n in nodes or []:
                kids = n.get("children") or []
                if kids:
                    walk(kids)
                elif n.get("id") is not None:
                    ids.append(n["id"])
        walk(tree if isinstance(tree, list) else [])
        return ids

    def _parse(self, p):
        prices, sizes, images, meta = [], {}, [], {}
        colors = list(_first(p, COLOR_KEYS))
        for item in p.get("items", []):
            available = False
            for seller in item.get("sellers", []):
                offer = seller.get("commertialOffer", {})
                if offer.get("Price"):
                    prices.append(offer["Price"])
                if (offer.get("AvailableQuantity", 0) or 0) > 0:
                    available = True
            for label in _first(item, SIZE_KEYS):
                sizes[label] = sizes.get(label, False) or available
            for color in _first(item, COLOR_KEYS):
                if color not in colors:
                    colors.append(color)
            for img in item.get("images", []):
                url = img.get("imageUrl")
                if url:
                    # VTEX repite la misma foto con sufijos distintos (?v=, /100/100): se guarda la forma corta
                    canonical = url.split("?")[0].rstrip("/")
                    if canonical not in images:
                        images.append(canonical)
                        meta[canonical] = " ".join(
                            str(img.get(k) or "") for k in ("imageLabel", "imageText", "imageTag")).strip()
        for label in _first(p, SIZE_KEYS):
            sizes.setdefault(label, True)
        link = p.get("link") or f"{self.base_url}/{p.get('linkText', '')}/p"
        if link.startswith("/"):
            link = self.base_url + link
        # packs: VTEX marca los kits y cuántas copias trae un pedido; el nombre también puede decir "Pack 3 medias"
        is_kit = any(bool(item.get("isKit")) for item in p.get("items", []))
        multiplier = _max_multiplier(p.get("items", []))
        return RawProduct(
            external_id=str(p.get("productId")), name=p.get("productName", ""), url=link,
            price=min(prices) if prices else None, brand=p.get("brand", ""),
            category=" ".join(p.get("categories", []) or []), description=p.get("description", "") or "",
            colors=colors, sizes=list(sizes.items()), images=images, image_meta=meta,
            material=" ".join(_first(p, MATERIAL_KEYS)),
            is_kit=is_kit, unit_multiplier=multiplier if multiplier > 1 else None)
