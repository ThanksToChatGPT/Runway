from app.extractors.base import BaseExtractor
from app.models import RawProduct

# Catálogo fijo para desarrollo y pruebas locales: no hace ninguna petición de red.
MOCK_ITEMS = [
    ("mock-top-001", "Camiseta Oversize Algodón", "UrbanCO", "camisetas", "Negro", "$89.900 COP",
     "camiseta-oversize", "photo-1521572163474-6864f9cf17ab", ["S", "M", "L", "XL"]),
    ("mock-top-002", "Buzo Hoodie Esencial", "AndesWear", "buzos", "Beige", "$159.900",
     "buzo-hoodie-esencial", "photo-1556821840-3a63f95609a7", ["S", "M", "L"]),
    ("mock-bottom-001", "Jean Straight Fit Azul", "DenimLab", "pantalones", "Azul", "$169.900",
     "jean-straight-azul", "photo-1542272604-787c3835535d", ["28", "30", "32", "34"]),
    ("mock-bottom-002", "Pantalón Cargo Urbano", "UrbanCO", "joggers", "Verde Oliva", "$185.000",
     "pantalon-cargo-urbano", "photo-1517438476312-10d79c077509", ["30", "32", "34"]),
    ("mock-shoes-001", "Tenis Urbanos Blancos", "StepCO", "tenis", "Blanco", "$249.900",
     "tenis-urbanos-blancos", "photo-1549298916-b41d501d3772", ["38", "39", "40", "41", "42"]),
    ("mock-shoes-002", "Botines Cuero Negro", "StepCO", "zapatos", "Negro", "$319.900",
     "botines-cuero-negro", "photo-1608256246200-53e635b5b65f", ["39", "40", "41", "42"]),
]


class MockStoreExtractor(BaseExtractor):
    """Extractor de ejemplo para pruebas locales del MVP (`"platform": "mock"` o `slug` "mock")."""

    platform = "mock"

    def fetch(self):
        for count, (ext_id, title, brand, category, color, price, path, photo, sizes) in enumerate(MOCK_ITEMS, 1):
            yield RawProduct(
                external_id=ext_id, name=title, url=f"{self.base_url}/producto/{path}", price=price,
                brand=brand, category=category, colors=[color], sizes=[(s, True) for s in sizes],
                images=[f"https://images.unsplash.com/{photo}?w=600"])
            if self.max_products and count >= self.max_products:
                return
