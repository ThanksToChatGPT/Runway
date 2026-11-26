"""Tiendas VTEX IO cuya API de catálogo clásica está cerrada (HTTP 401/403) pero que siguen respondiendo
la API de Intelligent Search, la misma que usa su tienda: /api/io/_v/api/intelligent-search/product_search

Esa API solo sirve una ventana limitada de resultados por consulta, así que para leer la mayor parte del
catálogo se vuelve a leer con varios órdenes y se unen los resultados (sin repetir productos)."""
from app.extractors.vtex import VtexExtractor, _max_multiplier
from app.polite_http import FetchError

SIZE_WORDS = ("talla", "size", "tamano", "tamaño")
COLOR_WORDS = ("color", "colour")
MATERIAL_WORDS = ("material", "composicion", "composición", "tela")
DEFAULT_PATH = "/api/io/_v/api/intelligent-search/product_search"
DEFAULT_SORTS = ["", "name:asc", "name:desc", "price:asc", "price:desc", "release:desc", "orders:desc", "discount:desc"]


def _is(name, words):
    name = (name or "").lower()
    return any(w in name for w in words)


class VtexIntelligentSearchExtractor(VtexExtractor):
    platform = "vtex_is"
    PAGE = 48

    def fetch(self):
        path = self.config.get("path", DEFAULT_PATH)
        facets = self.config.get("facets", "")                     # p. ej. "/category-1/hombre" para una sección
        url = f"{self.base_url}{path}{facets}"
        extra = self.config.get("params") or {}
        base_params = {"query": self.config.get("query", ""), "count": self.PAGE,
                       "locale": self.config.get("locale", "es-CO"), "hideUnavailableItems": "false",
                       **(extra if isinstance(extra, dict) else {})}
        seen, count, worked = set(), 0, False
        self._total = None
        for sort in self.config.get("sorts", DEFAULT_SORTS):
            params = {**base_params, "sort": sort} if sort else dict(base_params)
            try:
                for p in self._pages(url, params, seen):
                    raw = self._safe_parse(p)
                    if raw is None:
                        continue
                    yield raw
                    count += 1
                    if self.max_products and count >= self.max_products:
                        return
                worked = True
            except FetchError:
                if not worked:
                    raise                                          # el primer listado tiene que funcionar
                continue                                           # un orden que la tienda no acepta: se salta
            if self._total and len(seen) >= self._total:
                return                                             # ya están todos los productos

    def _pages(self, url, params, seen):
        for page in range(1, self._int_config("max_pages", 100) + 1):
            data = self.client.get_json(url, params={**params, "page": page})
            if not isinstance(data, dict):
                return
            products = data.get("products") or []
            if self._total is None and data.get("recordsFiltered"):
                self._total = data["recordsFiltered"]
            if not products:
                return
            for p in products:
                pid = p.get("productId")
                if pid not in seen:
                    seen.add(pid)
                    yield p
            if len(products) < self.PAGE:
                return

    def _parse(self, p):
        raw = super()._parse(p)
        sizes, colors = dict(raw.sizes), list(raw.colors)
        size_units = dict(raw.size_units)
        # Intelligent Search pone las opciones en items[].variations: [{"name": "Talla", "values": ["M"]}]
        for item in p.get("items", []):
            qty = max([(s.get("commertialOffer", {}).get("AvailableQuantity", 0) or 0)
                       for s in item.get("sellers", [])] or [0])
            for var in item.get("variations", []) or []:
                if not isinstance(var, dict):
                    continue
                values = var.get("values", [])
                values = values if isinstance(values, list) else [values]
                name = var.get("name", "")
                if _is(name, SIZE_WORDS):
                    for v in values:
                        sizes[v] = sizes.get(v, False) or qty > 0
                        if raw.units is not None:
                            size_units[v] = size_units.get(v, 0) + qty
                elif _is(name, COLOR_WORDS):
                    colors += [v for v in values if v not in colors]
        for spec in p.get("skuSpecifications", []) or []:
            name = (spec.get("field") or {}).get("name", "")
            values = [v.get("name") for v in spec.get("values", []) if v.get("name")]
            if _is(name, SIZE_WORDS):
                for v in values:
                    sizes.setdefault(v, True)
            elif _is(name, COLOR_WORDS):
                colors += [v for v in values if v not in colors]
        material = raw.material
        for prop in p.get("properties", []) or []:
            if _is(prop.get("name"), MATERIAL_WORDS) and not material:
                material = " ".join(str(v) for v in prop.get("values", []))
        raw.sizes, raw.colors, raw.material, raw.size_units = list(sizes.items()), colors, material, size_units
        # Intelligent Search también dice cuántas copias trae un pedido (unitMultiplier por ítem)
        mult = _max_multiplier(p.get("items", []), raw.unit_multiplier or 1.0)
        raw.unit_multiplier = mult if mult > 1 else None
        return raw
