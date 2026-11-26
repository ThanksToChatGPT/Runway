from dataclasses import dataclass, field


@dataclass
class RawProduct:
    """Lo que un extractor lee de una tienda, antes de limpiarlo."""
    external_id: str
    name: str
    url: str
    price: object = None                      # número o texto como "$ 149.900"
    brand: str = ""
    category: str = ""                        # texto crudo de categoría (tipo, breadcrumb, tags)
    description: str = ""
    colors: list = field(default_factory=list)
    sizes: list = field(default_factory=list)  # lista de (etiqueta, disponible)
    images: list = field(default_factory=list)
    material: str = ""
    image_meta: dict = field(default_factory=dict)   # url de imagen -> pistas de texto (alt, etiqueta)
    is_kit: bool = False                      # VTEX: el producto es un kit (varias piezas juntas)
    unit_multiplier: object = None            # VTEX: cuántas copias trae una compra


@dataclass
class Product:
    """Producto limpio, con las categorías del MVP (`top`, `bottom`, `shoes`) o `accessory`/`other`."""
    external_id: str
    name: str
    brand: object
    category: str
    subcategory: str
    material: str
    color: object
    price_cop: int
    external_url: str
    description: str = ""
    images: list = field(default_factory=list)       # URLs en orden; la primera es la principal
    sizes: list = field(default_factory=list)        # lista de (talla, disponible)
    pack_size: int = 1                               # 1 = una sola prenda; 2+ = pack/kit de N piezas
    pack_evidence: str = ""                          # por qué se cree que es un pack

    def to_contract(self):
        """Ítem de la respuesta de `POST /scrape` (lo traduce `HttpScraperAdapter` en el backend)."""
        return {
            "external_id": self.external_id,
            "title": self.name,
            "brand": self.brand or None,
            "category": self.category,
            "subcategory": self.subcategory or None,
            "color": self.color or None,
            "material": self.material or None,
            "price_cop": self.price_cop,
            "product_url": self.external_url,
            "description": self.description or None,
            "images": list(self.images),
            "sizes": [{"size": size, "in_stock": bool(ok)} for size, ok in self.sizes],
        }
