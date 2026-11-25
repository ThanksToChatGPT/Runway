import re
from typing import Any

CATEGORY_MAP = {
    "top": "top",
    "camiseta": "top",
    "camisetas": "top",
    "camisa": "top",
    "camisas": "top",
    "buzo": "top",
    "buzos": "top",
    "hoodie": "top",
    "chaqueta": "top",
    "bottom": "bottom",
    "pantalon": "bottom",
    "pantalones": "bottom",
    "jean": "bottom",
    "jeans": "bottom",
    "jogger": "bottom",
    "joggers": "bottom",
    "short": "bottom",
    "shoes": "shoes",
    "tenis": "shoes",
    "zapato": "shoes",
    "zapatos": "shoes",
    "botin": "shoes",
    "botines": "shoes",
    "calzado": "shoes",
}

COLOR_MAP = {
    "negro": "Negro",
    "black": "Negro",
    "blanco": "Blanco",
    "white": "Blanco",
    "azul": "Azul",
    "blue": "Azul",
    "beige": "Beige",
    "gris": "Gris",
    "gray": "Gris",
    "verde": "Verde",
    "verde oliva": "Verde",
    "rojo": "Rojo",
}


def normalize_category(raw: str) -> str:
    key = (raw or "").strip().lower()
    return CATEGORY_MAP.get(key, "top")


def normalize_color(raw: str) -> str:
    key = (raw or "").strip().lower()
    return COLOR_MAP.get(key, (raw or "Otro").strip().title())


def normalize_price_cop(raw: Any) -> int:
    if isinstance(raw, (int, float)):
        return max(0, int(round(raw)))
    digits = re.sub(r"[^\d]", "", str(raw or "0"))
    return max(0, int(digits)) if digits else 0


def normalize_sizes(raw_sizes: list[Any]) -> list[dict[str, Any]]:
    seen = set()
    normalized = []
    for item in raw_sizes or []:
        if isinstance(item, dict):
            size_str = str(item.get("size", "")).strip().upper()
            in_stock = bool(item.get("in_stock", True))
        else:
            size_str = str(item).strip().upper()
            in_stock = True
        if size_str and size_str not in seen:
            seen.add(size_str)
            normalized.append({"size": size_str, "in_stock": in_stock})
    return normalized


def normalize_product(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "external_id": str(raw.get("external_id", "")).strip(),
        "title": str(raw.get("title", "Producto sin título")).strip(),
        "brand": str(raw.get("brand", "Genérica")).strip(),
        "category": normalize_category(str(raw.get("raw_category", raw.get("category", "top")))),
        "color": normalize_color(str(raw.get("raw_color", raw.get("color", "Otro")))),
        "price_cop": normalize_price_cop(raw.get("raw_price", raw.get("price_cop", 0))),
        "product_url": str(raw.get("product_url", "")).strip(),
        "images": [str(img).strip() for img in (raw.get("images") or []) if str(img).strip()],
        "sizes": normalize_sizes(raw.get("sizes") or []),
    }
