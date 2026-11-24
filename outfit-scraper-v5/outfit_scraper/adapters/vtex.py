"""VTEX stores answer the public catalog search API. It also says how many units are left of every SKU."""
from ..models import RawProduct
from .base import BaseAdapter

SIZE_KEYS = ("Talla", "Size", "talla", "size")
COLOR_KEYS = ("Color", "color")
UNLIMITED = 9999          # VTEX shows 10000 when the store does not control its inventory: that is not a real count


def _first(d, keys):
    for k in keys:
        v = d.get(k)
        if v:
            return v if isinstance(v, list) else [v]
    return []


class VtexAdapter(BaseAdapter):
    platform = "vtex"
    PAGE = 50

    def fetch(self):
        seen, count = set(), 0
        extra = self.config.get("params", {})        # e.g. {"fq": "C:/12/"} to read one category
        sources = [dict(extra)]
        self._capped = False
        for source in sources:
            for p in self._read(source, seen):
                yield self._parse(p)
                count += 1
                if self.max_products and count >= self.max_products:
                    return
            # VTEX does not serve results beyond a window (2,500): when we reach it, read category by category
            if source is sources[0] and self._capped and self.config.get("split_by_category", True):
                sources += [{**extra, "fq": f"C:{cid}"} for cid in self._category_ids()]

    def _read(self, extra, seen):
        window = int(self.config.get("window", 2500))
        page = int(self.config.get("page_size", self.PAGE))
        start = 0
        while start < window:
            to = min(start + page, window) - 1
            items = self.client.get_json(f"{self.base_url}/api/catalog_system/pub/products/search",
                                         params={"_from": start, "_to": to, **extra})
            if not items:
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
        except Exception:
            return []
        ids = []

        def walk(nodes):
            for n in nodes:
                kids = n.get("children") or []
                if kids:
                    walk(kids)
                else:
                    ids.append(n["id"])
        walk(tree)
        return ids

    def _parse(self, p):
        prices, sizes, size_units, images, meta = [], {}, {}, [], {}
        colors = list(_first(p, COLOR_KEYS))
        total, unlimited = 0, False
        for item in p.get("items", []):
            qty, available = 0, False
            for seller in item.get("sellers", []):
                offer = seller.get("commertialOffer", {})
                if offer.get("Price"):
                    prices.append(offer["Price"])
                q = offer.get("AvailableQuantity", 0) or 0
                qty = max(qty, q)
                if q > 0:
                    available = True
            unlimited = unlimited or qty > UNLIMITED
            total += qty
            for label in _first(item, SIZE_KEYS):
                sizes[label] = sizes.get(label, False) or available
                size_units[label] = size_units.get(label, 0) + qty
            for color in _first(item, COLOR_KEYS):
                if color not in colors:
                    colors.append(color)
            for img in item.get("images", []):
                url = img.get("imageUrl")
                if url and url not in meta:
                    # VTEX often repeats the same photo with different URL suffixes (?v=, /100/100):
                    # keep the shortest form so the viewer does not show the same picture twice.
                    canonical = url.split("?")[0].rstrip("/")
                    if canonical not in images:
                        images.append(canonical)
                        meta[canonical] = f"{img.get('imageLabel') or ''} {img.get('imageText') or ''} {img.get('imageTag') or ''}"
        for label in _first(p, SIZE_KEYS):
            sizes.setdefault(label, True)
        link = p.get("link") or f"{self.base_url}/{p.get('linkText', '')}/p"
        if link.startswith("/"):
            link = self.base_url + link
        has_items = bool(p.get("items"))
        # packs: VTEX marks kits and how many copies an order contains; the name may also say "Pack 3 medias"
        is_kit = any(bool(item.get("isKit")) for item in p.get("items", []))
        multiplier = 1.0
        for item in p.get("items", []):
            try:
                m = item.get("unitMultiplier")
                if m and float(m) > multiplier:
                    multiplier = float(m)
            except (TypeError, ValueError):
                pass
        return RawProduct(
            external_id=str(p.get("productId")), name=p.get("productName", ""), url=link,
            price=min(prices) if prices else None, brand=p.get("brand", ""),
            category=" ".join(p.get("categories", [])), description=p.get("description", ""),
            colors=colors, sizes=list(sizes.items()), images=images, image_meta=meta,
            material=" ".join(_first(p, ("Material", "material", "Composición tela 1"))),
            units=None if (unlimited or not has_items) else total,
            size_units={} if unlimited else size_units,
            is_kit=is_kit, unit_multiplier=multiplier if multiplier > 1 else None)
