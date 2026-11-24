"""VTEX IO stores whose legacy catalog API is closed (HTTP 401/403) still answer the Intelligent Search API,
the same one their own storefront uses: /api/io/_v/api/intelligent-search/product_search

That API only serves a limited window of results per query, so to read as much of the catalog as possible
we read it again with several sort orders and join the results (without repeating products)."""
from .vtex import UNLIMITED, VtexAdapter

SIZE_WORDS = ("talla", "size", "tamano", "tamaño")
COLOR_WORDS = ("color", "colour")
MATERIAL_WORDS = ("material", "composicion", "composición", "tela")
DEFAULT_SORTS = ["", "name:asc", "name:desc", "price:asc", "price:desc", "release:desc", "orders:desc", "discount:desc"]


def _is(name, words):
    name = (name or "").lower()
    return any(w in name for w in words)


class VtexIntelligentSearchAdapter(VtexAdapter):
    platform = "vtex_is"
    PAGE = 48

    def fetch(self):
        path = self.config.get("path", "/api/io/_v/api/intelligent-search/product_search")
        facets = self.config.get("facets", "")                    # e.g. "/category-1/hombre" to read one section
        url = f"{self.base_url}{path}{facets}"
        base_params = {"query": self.config.get("query", ""), "count": self.PAGE,
                       "locale": self.config.get("locale", "es-CO"), "hideUnavailableItems": "false",
                       **self.config.get("params", {})}
        seen, count, worked = set(), 0, False
        self._total = None
        for sort in self.config.get("sorts", DEFAULT_SORTS):
            params = {**base_params, "sort": sort} if sort else dict(base_params)
            try:
                for p in self._pages(url, params, seen):
                    yield self._parse(p)
                    count += 1
                    if self.max_products and count >= self.max_products:
                        return
                worked = True
            except RuntimeError:
                if not worked:
                    raise                                         # the first listing must work
                continue                                          # a sort order this store does not accept: skip it
            if self._total and len(seen) >= self._total:
                return                                            # we already have every product

    def _pages(self, url, params, seen):
        for page in range(1, int(self.config.get("max_pages", 100)) + 1):
            data = self.client.get_json(url, params={**params, "page": page})
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
        # Intelligent Search puts the options in items[].variations: [{"name": "Talla", "values": ["M"]}]
        for item in p.get("items", []):
            qty = max([(s.get("commertialOffer", {}).get("AvailableQuantity", 0) or 0) for s in item.get("sellers", [])] or [0])
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
                material = " ".join(prop.get("values", []))
        raw.sizes, raw.colors, raw.material, raw.size_units = list(sizes.items()), colors, material, size_units
        # Intelligent Search also says how many copies one order contains (unitMultiplier per item)
        mult = raw.unit_multiplier or 1.0
        for item in p.get("items", []):
            try:
                m = item.get("unitMultiplier")
                if m and float(m) > mult:
                    mult = float(m)
            except (TypeError, ValueError):
                pass
        raw.unit_multiplier = mult if mult > 1 else None
        return raw
