"""Cleans raw store data into the common values used by the app (colors, sizes, categories, price)."""
import re
import unicodedata

from .models import Product, RawProduct


def _plain(text):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return text.lower().strip()


def parse_price(value):
    """'$ 149.900' -> 149900.0, '180000.00' -> 180000.0, '1,299.90' -> 1299.9. Returns None if not a price."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    text = re.sub(r"[^\d.,]", "", str(value))
    if not text:
        return None
    if "." in text and "," in text:
        decimal = "." if text.rfind(".") > text.rfind(",") else ","
        text = text.replace("," if decimal == "." else ".", "").replace(decimal, ".")
    elif "." in text or "," in text:
        sep = "." if "." in text else ","
        last = text.split(sep)[-1]
        if text.count(sep) > 1 or len(last) == 3:   # thousands separator
            text = text.replace(sep, "")
        else:
            text = text.replace(sep, ".")
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None


COLORS = {
    "negro": "black", "black": "black", "blanco": "white", "white": "white", "crudo": "white",
    "marfil": "white", "hueso": "white", "perla": "white", "off white": "white",
    "gris": "gray", "gray": "gray", "grey": "gray", "azul": "blue", "blue": "blue", "navy": "blue",
    "rojo": "red", "red": "red", "vinotinto": "red", "vino": "red", "borgona": "red", "burdeos": "red",
    "verde": "green", "green": "green", "esmeralda": "green",
    "amarillo": "yellow", "yellow": "yellow", "mostaza": "yellow",
    "beige": "beige", "crema": "beige", "khaki": "beige", "arena": "beige",
    "kaki": "beige", "caqui": "beige", "cafe": "brown", "marron": "brown", "brown": "brown",
    "chocolate": "brown", "canela": "brown", "bronce": "brown",
    "rosado": "pink", "rosa": "pink", "pink": "pink", "fucsia": "pink", "coral": "pink",
    "morado": "purple", "lila": "purple", "purple": "purple", "lavanda": "purple", "uva": "purple",
    "naranja": "orange", "orange": "orange", "terracota": "orange",
    "turquesa": "cyan", "celeste": "cyan", "aqua": "cyan", "cian": "cyan", "cyan": "cyan",
    "dorado": "gold", "oro": "gold", "plateado": "silver", "plata": "silver", "silver": "silver",
}


def _color_of(token):
    # also accept Spanish plurals and feminine forms: negra, blancas, rojas...
    singular = token.rstrip("s") if len(token) > 3 else token
    for candidate in (token, singular, singular[:-1] + "o" if singular.endswith("a") else None):
        if candidate in COLORS:
            return COLORS[candidate]
    return ""


def normalize_color(*texts):
    for text in texts:
        for token in re.findall(r"[a-z]+", _plain(text)):
            color = _color_of(token)
            if color:
                return color
    return ""


def normalize_size(label):
    text = _plain(label).upper().replace("TALLA", "").strip()
    if text in {"U", "UNICA", "UNICO", "ONE SIZE", "OS", "UNICA TALLA", "UNITALLA"}:
        return "ONE SIZE"
    text = {"2XL": "XXL", "3XL": "XXXL", "EXTRA LARGE": "XL", "EXTRA SMALL": "XS",
            "SMALL": "S", "MEDIUM": "M", "LARGE": "L"}.get(text, text)
    if text in {"XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"}:
        return text
    match = re.fullmatch(r"\d{1,2}([.,]\d)?", text)
    if match:
        return text.replace(",", ".")
    return text[:12] if text else ""


CATEGORY_RULES = [
    (r"\b(hoodie|buzo|sudadera con capucha|canguro)\b", "top", "hoodie"),
    (r"\b(camiseta|t-?shirt|tee|playera|polo|body|top)s?\b", "top", "t-shirt"),
    (r"\b(camisa|blusa|shirt)s?\b", "top", "shirt"),
    (r"\b(chaqueta|chamarra|abrigo|jacket|coat|cortavientos|blazer)s?\b", "top", "jacket"),
    (r"\b(jean|jeans|vaquero)s?\b", "bottom", "jeans"),
    (r"\bcargo\b", "bottom", "cargo"),
    (r"\b(short|bermuda)s?\b", "bottom", "shorts"),
    (r"\b(pantalon|pantalones|jogger|pants|trouser)s?\b", "bottom", "pants"),
    (r"\b(tenis|sneaker|zapatilla)s?\b", "footwear", "sneakers"),
    (r"\b(bota|botin|boot)s?\b", "footwear", "boots"),
    (r"\b(zapato|mocasin|sandalia|shoe)s?\b", "footwear", "shoes"),
    (r"\b(gorra|cap|sombrero|beanie|gorro)s?\b", "accessory", "cap"),
    (r"\b(gafa|lente|sunglass|glasses)s?\b", "accessory", "glasses"),
    (r"\b(bolso|mochila|morral|bag|cartera|rinonera)s?\b", "accessory", "bag"),
    (r"\b(reloj|watch)\b", "accessory", "watch"),
]


def classify(name, raw_category=""):
    # the product name is stronger than the raw category, so test it first
    for text in (_plain(name), _plain(raw_category)):
        for pattern, category, sub in CATEGORY_RULES:
            if re.search(pattern, text):
                return category, sub
    return "other", ""


MATERIALS = [
    ("algodon", "cotton"), ("cotton", "cotton"), ("denim", "denim"), ("poliester", "polyester"),
    ("polyester", "polyester"), ("lana", "wool"), ("wool", "wool"), ("cuero", "leather"),
    ("leather", "leather"), ("lino", "linen"), ("linen", "linen"), ("nylon", "nylon"),
    ("nailon", "nylon"), ("elastano", "elastane"), ("licra", "elastane"), ("spandex", "elastane"),
    ("viscosa", "viscose"), ("viscose", "viscose"),
]


# ---------- single garment or pack? ----------
# "1 unidad" here means the product is ONE garment: not a pack of 3 pairs of socks, not a kit with
# shirt + shorts. The store may say it (VTEX: isKit, unitMultiplier, "Unidades") or the name may say it
# ("Pack 3 medias", "Combo jean + buzo", "2 x camisetas", "juego de 2").
PACK_WORDS = r"(packs?|kits?|combos?|sets?|juegos?|pares?|duos?|trios?|lotes?)"
PACK_PATTERNS = [
    rf"\b(\d+)\s*(?:x|por)\s*\w+",                # "3 x camisetas", "2 por calzas"
    r"\bx\s*(\d+)\b",                             # "medias x3"
    rf"\b{PACK_WORDS}\b(?:\s+de)?\s*(\d+)?",      # "pack 3 medias", "kit de 2", "combo"
    r"\b(\d+)\s*(?:unidades|unit|units|pieces?|pzs?)\b",   # "3 unidades", "2 pieces"
    r"\b(\d+)\s*(?:pares?|box|caja|bolsa)\b",     # "3 pares"
    r"\b(?:unidades|unit)\b[^\d]{0,12}(\d+)\b",    # "Unidades: 3" (reordered by the store)
]
FABRIC_PATTERNS = [r"\b(?:rib|punto|tejido|tejido|punto)\s*\d\s*[x×]\s*\d\b",   # "rib 2x2" is a fabric, not a pack
                   r"\b\d\s*[x×]\s*\d\s*(?:rib|elastano|licra|algodón|algodon)\b"]


def detect_pack(*texts, is_kit=False, unit_multiplier=None, units_hint=None):
    """Returns (pack_size, evidence) for the raw texts of a product.
    pack_size 1 = a single garment; 2+ = a pack/kit of that many pieces; the evidence says why."""
    plain = _plain(" ".join(t for t in texts if t))
    for fabric in FABRIC_PATTERNS:               # "rib 2X2" says how the fabric is knitted, not a pack
        if re.search(fabric, plain):
            plain = re.sub(fabric, " ", plain)
    for pattern in PACK_PATTERNS:
        m = re.search(pattern, plain)
        if m:
            # the number may be inside the pattern or right after the keyword: "pack 3 medias"
            number = next((g for g in m.groups() if g and g.isdigit()), None)
            if not number:
                after = re.search(r"\d+", plain[m.end():m.end() + 4])      # "pack de 3", "combo 2"
                number = after.group() if after else None
            if number:
                return int(number), f"name: {m.group(0).strip()!r}"
            return 2, f"name: {m.group(0).strip()!r}"
    # no number in the name: trust the structured signals the store gives
    mult = unit_multiplier or 1
    if mult > 1:
        return int(mult), f"unitMultiplier={int(mult) if float(mult).is_integer() else mult}"
    if is_kit:
        return 2, "isKit"
    if units_hint and units_hint > 1:
        return int(units_hint), "units field"
    return 1, ""      # no pack evidence anywhere: it sells as a single garment


def normalize_material(*texts):
    plain = " ".join(_plain(t) for t in texts)
    found = []
    for key, value in MATERIALS:
        if key in plain and value not in found:
            found.append(value)
    return "/".join(found[:2])


def clean_text(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(text or ""))).strip()


def normalize(raw: RawProduct, store):
    """Returns (Product, None) or (None, reason) when the record is not usable."""
    name = clean_text(raw.name)
    if not name:
        return None, "missing name"
    if not raw.url:
        return None, "missing url"
    price = parse_price(raw.price)
    if price is None or price > 50_000_000:
        return None, f"invalid price: {raw.price!r}"
    category, sub = classify(name, raw.category)
    sizes, seen = [], set()
    for label, available in raw.sizes:
        size = normalize_size(label)
        if size and size not in seen:
            seen.add(size)
            sizes.append((size, bool(available)))
    images = []
    for url in raw.images:
        if url and url not in images:
            images.append(url)
    brand = clean_text(raw.brand) or store["name"]
    size_units = {}
    for label, qty in (raw.size_units or {}).items():
        key = normalize_size(label)
        if key and qty is not None:
            size_units[key] = size_units.get(key, 0) + int(qty)
    units = None if raw.units is None else int(raw.units)
    pack_size, pack_evidence = detect_pack(name, raw.category, raw.description,
                                           is_kit=bool(raw.is_kit), unit_multiplier=raw.unit_multiplier)
    return Product(
        id=f"{store['id']}:{raw.external_id}", store_id=store["id"], name=name, brand=brand,
        category=category, subcategory=sub,
        material=normalize_material(raw.material, raw.description, name),
        color=normalize_color(*raw.colors, name), price_cop=price, external_url=raw.url,
        images=images, sizes=sizes, units_total=units, size_units=size_units,
        pack_size=pack_size, pack_evidence=pack_evidence), None
