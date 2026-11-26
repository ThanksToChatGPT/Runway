"""Limpia los datos crudos de las tiendas con los valores comunes del MVP (precio en COP, color, tallas,
categoría `top`/`bottom`/`shoes`, subcategoría, material) y detecta packs/kits de varias prendas.

Los valores salen en el vocabulario que estandariza el backend (`catalogStandardizer.js`): colores
canónicos en inglés (`black`, `navy`…), tallas `S`/`M`/`UNICA`/`38.5` y categorías del MVP. El backend
vuelve a estandarizar, así que esto solo garantiza que el scraper no le entregue basura.
"""
import re
import unicodedata

from app.models import Product, RawProduct

MVP_CATEGORIES = ("top", "bottom", "shoes")
MAX_PRICE_COP = 50_000_000
MAX_DESCRIPTION = 1000


def _plain(text):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return text.lower().strip()


def clean_text(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(text or ""))).strip()


# ---------------------------------------------------------------- precio

def parse_price(value):
    """'$ 149.900' -> 149900.0, '180000.00' -> 180000.0, '1,299.90' -> 1299.9. None si no es un precio.

    Corrige el bug de decimales en COP: quitar todo lo que no fuera dígito convertía '180000.00'
    en 18 000 000. Aquí el último separador se interpreta como decimal solo si no tiene 3 dígitos."""
    if value is None or value == "" or isinstance(value, bool):
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
        if text.count(sep) > 1 or len(last) == 3:   # separador de miles
            text = text.replace(sep, "")
        else:
            text = text.replace(sep, ".")
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None


# ---------------------------------------------------------------- color

# Frases de varias palabras que se revisan antes que las palabras sueltas ("azul marino" no es "azul").
COLOR_PHRASES = [
    ("azul marino", "navy"), ("azul oscuro", "navy"), ("navy blue", "navy"),
    ("off white", "white"), ("verde oliva", "green"), ("verde militar", "green"),
]
COLORS = {
    "negro": "black", "black": "black", "noir": "black",
    "blanco": "white", "white": "white", "crudo": "white", "marfil": "white", "hueso": "white",
    "perla": "white", "ivory": "white",
    "gris": "gray", "gray": "gray", "grey": "gray", "grafito": "gray", "charcoal": "gray",
    "plata": "gray", "plateado": "gray", "silver": "gray",
    "azul": "blue", "blue": "blue", "celeste": "blue", "turquesa": "blue", "aqua": "blue",
    "cian": "blue", "cyan": "blue",
    "navy": "navy", "marino": "navy",
    "rojo": "red", "red": "red", "vinotinto": "red", "vino": "red", "borgona": "red", "burdeos": "red",
    "granate": "red", "burgundy": "red",
    "verde": "green", "green": "green", "esmeralda": "green", "oliva": "green", "olive": "green",
    "militar": "green",
    "amarillo": "yellow", "yellow": "yellow", "mostaza": "yellow", "mustard": "yellow",
    "dorado": "yellow", "oro": "yellow", "gold": "yellow",
    "naranja": "orange", "orange": "orange", "terracota": "orange", "coral": "orange",
    "rosado": "pink", "rosa": "pink", "pink": "pink", "fucsia": "pink",
    "morado": "purple", "lila": "purple", "purple": "purple", "lavanda": "purple", "uva": "purple",
    "violeta": "purple",
    "cafe": "brown", "marron": "brown", "brown": "brown", "chocolate": "brown", "canela": "brown",
    "bronce": "brown", "camel": "brown", "cognac": "brown",
    "beige": "beige", "crema": "beige", "khaki": "beige", "arena": "beige", "kaki": "beige",
    "caqui": "beige", "nude": "beige", "cream": "beige", "sand": "beige",
    "multicolor": "multicolor",
}


def _color_of(token):
    # también acepta plurales y femeninos: negra, blancas, rojas...
    singular = token.rstrip("s") if len(token) > 3 else token
    for candidate in (token, singular, singular[:-1] + "o" if singular.endswith("a") else None):
        if candidate in COLORS:
            return COLORS[candidate]
    return ""


def normalize_color(*texts):
    """Primer color reconocido en los textos (colores de la tienda primero, luego el nombre)."""
    for text in texts:
        plain = _plain(text)
        for phrase, color in COLOR_PHRASES:
            if re.search(rf"\b{phrase}\b", plain):
                return color
        for token in re.findall(r"[a-z]+", plain):
            color = _color_of(token)
            if color:
                return color
    return ""


# ---------------------------------------------------------------- talla

def normalize_size(label):
    text = re.sub(r"\s+", " ", _plain(label).upper().replace("TALLA", "")).strip()
    if text in {"U", "UNICA", "UNICO", "ONE SIZE", "OS", "UNICA TALLA", "UNITALLA", "TU"}:
        return "UNICA"
    text = {"2XL": "XXL", "3XL": "XXXL", "2XS": "XXS", "EXTRA LARGE": "XL", "EXTRA SMALL": "XS",
            "SMALL": "S", "MEDIUM": "M", "LARGE": "L"}.get(text, text)
    if text in {"XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"}:
        return text
    if re.fullmatch(r"\d{1,2}([.,]\d)?", text):
        return text.replace(",", ".")
    return text[:12] if text else ""


# ---------------------------------------------------------------- categoría

_P = r"(?:es|s)?"          # plural en español o inglés: botin -> botines, camisa -> camisas
CATEGORY_RULES = [
    # lo que no es del MVP se revisa primero para que "Pack 3 medias" o "Body splash" no terminen como "top"
    (rf"\b(perfume{_P}|fragancia{_P}|locion{_P}|colonia{_P}|body splash|body mist|tarjeta{_P} de regalo"
     rf"|gift cards?|bono{_P} de regalo)\b", "other", "non-garment"),
    (rf"\b(medias?|calcetin{_P}|socks?|tobillera{_P})\b", "other", "socks"),
    (rf"\b(boxer{_P}|panty|panties|brasier{_P}|bralette{_P}|calzoncillo{_P}|pantaloncillo{_P}|ropa interior"
     rf"|lenceria)\b", "other", "underwear"),
    (rf"\b(pijama{_P})\b", "other", "sleepwear"),
    (rf"\b(vestido{_P} de bano|traje{_P} de bano|bikini{_P}|trikini{_P}|banador{_P}|swimsuit{_P})\b",
     "other", "swimwear"),
    (rf"\b(vestido{_P}|enterizo{_P}|jumpsuit{_P}|overol{_P})\b", "other", "dress"),
    # top
    (rf"\b(hoodie{_P}|buzo{_P}|sudadera{_P} con capucha|canguro{_P})\b", "top", "hoodie"),
    (rf"\b(camiseta{_P}|t-?shirt{_P}|tshirt{_P}|tee{_P}|playera{_P}|polo{_P}|body{_P}|bodies|top{_P}"
     rf"|crop{_P})\b", "top", "t-shirt"),
    (rf"\b(esqueleto{_P}|tank{_P}|musculosa{_P})\b", "top", "tank-top"),
    (rf"\b(camisa{_P}|blusa{_P}|shirt{_P}|guayabera{_P})\b", "top", "shirt"),
    (rf"\b(sueter{_P}|sweater{_P}|saco{_P}|cardigan{_P}|pullover{_P})\b", "top", "sweater"),
    (rf"\b(chaqueta{_P}|chamarra{_P}|abrigo{_P}|jacket{_P}|coat{_P}|cortavientos|blazer{_P}|parka{_P})\b",
     "top", "jacket"),
    (rf"\b(chaleco{_P}|vest{_P})\b", "top", "vest"),
    # bottom
    (rf"\b(jean{_P}|vaquero{_P})\b", "bottom", "jeans"),
    (r"\bcargo\b", "bottom", "cargo"),
    (rf"\b(short{_P}|bermuda{_P})\b", "bottom", "shorts"),
    (rf"\b(falda{_P}|minifalda{_P}|skirt{_P})\b", "bottom", "skirt"),
    (rf"\b(leggings?|leggins?|licra{_P})\b", "bottom", "leggings"),
    (rf"\b(pantalon{_P}|jogger{_P}|pants|trouser{_P}|sudadera{_P})\b", "bottom", "pants"),
    # shoes
    (rf"\b(tenis|sneaker{_P}|zapatilla{_P})\b", "shoes", "sneakers"),
    (rf"\b(bota{_P}|botin{_P}|boot{_P})\b", "shoes", "boots"),
    (rf"\b(sandalia{_P}|chancla{_P}|flip flops?)\b", "shoes", "sandals"),
    (rf"\b(tacon{_P}|stiletto{_P}|heel{_P})\b", "shoes", "heels"),
    (rf"\b(mocasin{_P}|loafer{_P})\b", "shoes", "loafers"),
    (rf"\b(baleta{_P}|balerina{_P})\b", "shoes", "flats"),
    (rf"\b(zapato{_P}|calzado{_P}|shoe{_P}|footwear)\b", "shoes", "shoes"),
    # accesorios (fuera del MVP)
    (rf"\b(gorra{_P}|cap{_P}|sombrero{_P}|beanie{_P}|gorro{_P})\b", "accessory", "cap"),
    (rf"\b(gafa{_P}|lente{_P}|sunglass{_P}|glasses)\b", "accessory", "glasses"),
    (rf"\b(bolso{_P}|mochila{_P}|morral{_P}|bag{_P}|cartera{_P}|rinonera{_P}|billetera{_P})\b",
     "accessory", "bag"),
    (rf"\b(reloj{_P}|watch{_P})\b", "accessory", "watch"),
    (rf"\b(cinturon{_P}|correa{_P}|belt{_P}|bufanda{_P}|guante{_P}|arete{_P}|collar{_P}|manilla{_P})\b",
     "accessory", "accessory"),
]


def classify(name, raw_category=""):
    """(categoría, subcategoría). El nombre del producto pesa más que la categoría cruda de la tienda."""
    for text in (_plain(name), _plain(raw_category)):
        for pattern, category, sub in CATEGORY_RULES:
            if re.search(pattern, text):
                return category, sub
    return "other", ""


# ---------------------------------------------------------------- material

MATERIALS = [
    ("algodon", "cotton"), ("cotton", "cotton"), ("denim", "denim"), ("poliester", "polyester"),
    ("polyester", "polyester"), ("lana", "wool"), ("wool", "wool"), ("cuero", "leather"),
    ("leather", "leather"), ("lino", "linen"), ("linen", "linen"), ("nylon", "nylon"),
    ("nailon", "nylon"), ("elastano", "elastane"), ("licra", "elastane"), ("lycra", "elastane"),
    ("spandex", "elastane"), ("viscosa", "viscose"), ("viscose", "viscose"), ("rayon", "viscose"),
    ("seda", "silk"), ("silk", "silk"), ("gamuza", "suede"), ("suede", "suede"),
    ("lona", "canvas"), ("canvas", "canvas"), ("acrilico", "acrylic"), ("acrylic", "acrylic"),
]


def normalize_material(*texts):
    """Hasta dos materiales reconocidos, p. ej. 'cotton/elastane'. Palabras completas: 'masculino' no es lino."""
    plain = " ".join(_plain(t) for t in texts)
    found = []
    for key, value in MATERIALS:
        if value not in found and re.search(rf"\b{key}s?\b", plain):
            found.append(value)
    return "/".join(found[:2])


# ---------------------------------------------------------------- ¿una prenda o un pack?
# "1 unidad" significa que el producto es UNA prenda: no un pack de 3 pares de medias ni un kit de
# camisa + short. La tienda puede decirlo (VTEX: isKit, unitMultiplier) o lo dice el nombre
# ("Pack 3 medias", "Combo jean + buzo", "2 x camisetas", "juego de 2").
# "par" suelto no cuenta: un par de tenis es UNA prenda de calzado ("3 pares" sí es un pack).
PACK_WORDS = r"(packs?|kits?|combos?|sets?|juegos?|duos?|trios?|lotes?)"
MAX_PACK_SIZE = 12        # "Jean 32x34" es una talla, no un pack de 32
PACK_PATTERNS = [
    r"\b(\d+)\s*(?:x|por)\s*\w+",                 # "3 x camisetas", "2 por calzas"
    r"\bx\s*(\d+)\b",                             # "medias x3"
    rf"\b{PACK_WORDS}\b(?:\s+de)?\s*(\d+)?",      # "pack 3 medias", "kit de 2", "combo"
    r"\b(\d+)\s*(?:unidades|unit|units|pieces?|pzs?)\b",   # "3 unidades", "2 pieces"
    r"\b(\d+)\s*(?:pares?|box|caja|bolsa)\b",     # "3 pares"
    r"\b(?:unidades|unit)\b[^\d]{0,12}(\d+)\b",   # "Unidades: 3"
]
FABRIC_PATTERNS = [r"\b(?:rib|punto|tejido)\s*\d\s*[x×]\s*\d\b",        # "rib 2x2" es un tejido, no un pack
                   r"\b\d\s*[x×]\s*\d\s*(?:rib|elastano|licra|algodon)\b"]


def detect_pack(*texts, is_kit=False, unit_multiplier=None, units_hint=None):
    """(pack_size, evidencia). pack_size 1 = una sola prenda; 2+ = pack/kit de esas piezas."""
    plain = _plain(" ".join(str(t) for t in texts if t))
    for fabric in FABRIC_PATTERNS:
        plain = re.sub(fabric, " ", plain)
    for pattern in PACK_PATTERNS:
        m = re.search(pattern, plain)
        if m:
            # el número puede estar dentro del patrón o justo después de la palabra: "pack 3 medias"
            number = next((g for g in m.groups() if g and g.isdigit()), None)
            if not number:
                after = re.search(r"\d+", plain[m.end():m.end() + 4])      # "pack de 3", "combo 2"
                number = after.group() if after else None
            if number and 1 < int(number) <= MAX_PACK_SIZE:
                return int(number), f"name: {m.group(0).strip()!r}"
            if number:
                continue                     # "pack 1", "32x34": no es evidencia de varias prendas
            return 2, f"name: {m.group(0).strip()!r}"
    # sin número en el nombre: se confía en las señales estructuradas de la tienda
    mult = unit_multiplier or 1
    if mult > 1:
        return int(mult), f"unitMultiplier={int(mult) if float(mult).is_integer() else mult}"
    if is_kit:
        return 2, "isKit"
    if units_hint and units_hint > 1:
        return int(units_hint), "units field"
    return 1, ""


# ---------------------------------------------------------------- producto

def _absolute(url):
    url = str(url or "").strip()
    if url.startswith("//"):
        url = "https:" + url
    return url if re.match(r"https?://", url, re.I) else ""


def normalize(raw: RawProduct):
    """(Product, None) o (None, motivo) cuando el registro no sirve."""
    name = clean_text(raw.name)
    if not name:
        return None, "missing name"
    url = _absolute(raw.url)
    if not url:
        return None, "missing url"
    price = parse_price(raw.price)
    if price is None or price > MAX_PRICE_COP:
        return None, f"invalid price: {raw.price!r}"
    description = clean_text(raw.description)
    category, sub = classify(name, raw.category)
    sizes, seen = [], set()
    for entry in raw.sizes or []:
        label, available = entry if isinstance(entry, (tuple, list)) else (entry, True)
        size = normalize_size(label)
        if size and size not in seen:
            seen.add(size)
            sizes.append((size, bool(available)))
        elif size and available:                  # la misma talla repetida: disponible si alguna lo está
            sizes = [(s, ok or s == size) for s, ok in sizes]
    images = []
    for image in raw.images or []:
        image = _absolute(image)
        if image and image not in images:
            images.append(image)
    colors = [c for c in (raw.colors or []) if c]
    color = normalize_color(*colors, name) or (clean_text(colors[0]).lower() if colors else "")
    pack_size, pack_evidence = detect_pack(name, raw.category, description,
                                           is_kit=bool(raw.is_kit), unit_multiplier=raw.unit_multiplier)
    return Product(
        external_id=str(raw.external_id or "").strip() or url,
        name=name[:255], brand=clean_text(raw.brand) or None, category=category, subcategory=sub,
        material=normalize_material(raw.material, description, name), color=color,
        price_cop=int(round(price)), external_url=url, description=description[:MAX_DESCRIPTION],
        images=images, sizes=sizes, pack_size=pack_size, pack_evidence=pack_evidence), None
