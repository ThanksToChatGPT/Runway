from dataclasses import dataclass, field


@dataclass
class RawProduct:
    """What an adapter reads from a store, before cleaning."""
    external_id: str
    name: str
    url: str
    price: object = None                      # number or text such as "$ 149.900"
    brand: str = ""
    category: str = ""                        # raw category text (product type, breadcrumb, tags)
    description: str = ""
    colors: list = field(default_factory=list)
    sizes: list = field(default_factory=list)  # list of (label, available)
    images: list = field(default_factory=list)
    material: str = ""
    units: object = None                      # total units in stock (int), or None when the store does not say
    size_units: dict = field(default_factory=dict)   # size label -> units
    image_meta: dict = field(default_factory=dict)   # image url -> text hints (alt text, label, file name)
    is_kit: bool = False                      # VTEX: the product is a kit (several pieces sold together)
    unit_multiplier: object = None            # VTEX: how many copies of the item a purchase contains


@dataclass
class Product:
    """A clean product, ready to be saved (matches the Product, ProductImage and ProductSizeStock classes)."""
    id: str
    store_id: str
    name: str
    brand: str
    category: str          # top | bottom | footwear | accessory | other  (same values as SlotType)
    subcategory: str
    material: str
    color: str
    price_cop: float
    external_url: str
    images: list = field(default_factory=list)       # image URLs in display order, the first one is the primary image
    sizes: list = field(default_factory=list)        # list of (size, is_available)
    units_total: object = None                       # units in stock, None = unknown
    size_units: dict = field(default_factory=dict)   # size -> units
    image_kinds: dict = field(default_factory=dict)  # image url -> "product-only" | "model" | "other" | ""
    pack_size: object = 1                            # 1 = a single garment, 2+ = a pack/kit of that many pieces
    pack_evidence: str = ""                          # why we think it is a pack ("isKit", "name: 'pack'", ...)
