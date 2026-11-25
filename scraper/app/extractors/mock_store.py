from typing import Any
from app.extractors.base import BaseExtractor


class MockStoreExtractor(BaseExtractor):
    """Extractor de ejemplo funcional para pruebas locales del MVP."""

    def extract(self, base_url: str) -> list[dict[str, Any]]:
        base = base_url.rstrip("/")
        return [
            {
                "external_id": "mock-top-001",
                "title": "Camiseta Oversize Algodón",
                "brand": "UrbanCO",
                "raw_category": "camisetas",
                "raw_color": "Negro",
                "raw_price": "$89.900 COP",
                "product_url": f"{base}/producto/camiseta-oversize",
                "images": [
                    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600"
                ],
                "sizes": ["S", "M", "L", "XL"],
            },
            {
                "external_id": "mock-top-002",
                "title": "Buzo Hoodie Esencial",
                "brand": "AndesWear",
                "raw_category": "buzos",
                "raw_color": "Beige",
                "raw_price": "$159.900",
                "product_url": f"{base}/producto/buzo-hoodie-esencial",
                "images": [
                    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600"
                ],
                "sizes": ["S", "M", "L"],
            },
            {
                "external_id": "mock-bottom-001",
                "title": "Jean Straight Fit Azul",
                "brand": "DenimLab",
                "raw_category": "pantalones",
                "raw_color": "Azul",
                "raw_price": "$169.900",
                "product_url": f"{base}/producto/jean-straight-azul",
                "images": [
                    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600"
                ],
                "sizes": ["28", "30", "32", "34"],
            },
            {
                "external_id": "mock-bottom-002",
                "title": "Pantalón Cargo Urbano",
                "brand": "UrbanCO",
                "raw_category": "joggers",
                "raw_color": "Verde Oliva",
                "raw_price": "$185.000",
                "product_url": f"{base}/producto/pantalon-cargo-urbano",
                "images": [
                    "https://images.unsplash.com/photo-1517438476312-10d79c077509?w=600"
                ],
                "sizes": ["30", "32", "34"],
            },
            {
                "external_id": "mock-shoes-001",
                "title": "Tenis Urbanos Blancos",
                "brand": "StepCO",
                "raw_category": "tenis",
                "raw_color": "Blanco",
                "raw_price": "$249.900",
                "product_url": f"{base}/producto/tenis-urbanos-blancos",
                "images": [
                    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600"
                ],
                "sizes": ["38", "39", "40", "41", "42"],
            },
            {
                "external_id": "mock-shoes-002",
                "title": "Botines Cuero Negro",
                "brand": "StepCO",
                "raw_category": "zapatos",
                "raw_color": "Negro",
                "raw_price": "$319.900",
                "product_url": f"{base}/producto/botines-cuero-negro",
                "images": [
                    "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600"
                ],
                "sizes": ["39", "40", "41", "42"],
            },
        ]
