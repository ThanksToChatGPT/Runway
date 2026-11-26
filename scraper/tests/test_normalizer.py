import unittest

from app.models import RawProduct
from app.normalizer import (classify, detect_pack, normalize, normalize_color, normalize_material, normalize_size,
                            parse_price)


class PriceTests(unittest.TestCase):
    def test_price(self):
        for raw, expected in [("$ 149.900", 149900), ("180000.00", 180000), ("1.299.900", 1299900),
                              ("1,299.90", 1299.9), ("$99,900", 99900), (59900, 59900), ("", None),
                              ("agotado", None), (0, None), (None, None), ("$ 89.900 COP", 89900)]:
            self.assertEqual(parse_price(raw), expected, raw)

    def test_cop_decimals_bug_is_fixed(self):
        # el normalizador anterior quitaba todo lo que no fuera dígito: "180000.00" -> 18 000 000
        product, _ = normalize(RawProduct("1", "Camiseta negra", "https://x/p", "180000.00"))
        self.assertEqual(product.price_cop, 180000)
        product, _ = normalize(RawProduct("2", "Jean azul", "https://x/p", 149900.0))
        self.assertEqual(product.price_cop, 149900)
        self.assertIsInstance(product.price_cop, int)


class AttributeTests(unittest.TestCase):
    def test_color_size_category(self):
        self.assertEqual(normalize_color("Negro mate"), "black")
        self.assertEqual(normalize_color("Camiseta blanca"), "white")
        self.assertEqual(normalize_color("Zapatos rojos"), "red")
        self.assertEqual(normalize_size("Talla M"), "M")
        self.assertEqual(normalize_size("2XL"), "XXL")
        self.assertEqual(normalize_size("38,5"), "38.5")
        self.assertEqual(classify("Pantalón cargo negro"), ("bottom", "cargo"))
        self.assertEqual(classify("Buzo con capucha"), ("top", "hoodie"))
        self.assertEqual(classify("Cosa rara", ""), ("other", ""))

    def test_one_size_uses_backend_vocabulary(self):
        # el backend estandariza "UNICA"; "ONE SIZE" lo convertiría en "ONE" (descarta el prefijo "size")
        for label in ("Única", "U", "one size", "Talla única"):
            self.assertEqual(normalize_size(label), "UNICA", label)

    def test_colombian_colors_and_categories(self):
        # nombres que usan tiendas colombianas como Mattelsa (la lista corta anterior los perdía)
        self.assertEqual(normalize_color("Marfil"), "white")
        self.assertEqual(normalize_color("Crudo"), "white")
        self.assertEqual(normalize_color("Borgoña"), "red")
        self.assertEqual(normalize_color("Mostaza"), "yellow")
        self.assertEqual(normalize_color("Fucsia"), "pink")
        self.assertEqual(normalize_color("Café"), "brown")
        # alineados con los colores canónicos del backend (catalogStandardizer.js), que no tiene "cyan"
        self.assertEqual(normalize_color("Turquesa"), "blue")
        self.assertEqual(normalize_color("Celeste"), "blue")
        self.assertEqual(normalize_color("Azul marino"), "navy")
        self.assertEqual(normalize_color("Plateado"), "gray")
        self.assertEqual(classify("Body Azul Ícono"), ("top", "t-shirt"))
        self.assertEqual(classify("Crop Top Marfil Ícono"), ("top", "t-shirt"))

    def test_mvp_categories(self):
        self.assertEqual(classify("Tenis urbanos blancos"), ("shoes", "sneakers"))
        self.assertEqual(classify("Botines de cuero"), ("shoes", "boots"))
        self.assertEqual(classify("Sandalias planas"), ("shoes", "sandals"))
        self.assertEqual(classify("Falda midi"), ("bottom", "skirt"))
        self.assertEqual(classify("Jean bota recta"), ("bottom", "jeans"))        # "bota" = bota del pantalón
        self.assertEqual(classify("Sudadera jogger"), ("bottom", "pants"))
        self.assertEqual(classify("Suéter tejido"), ("top", "sweater"))
        self.assertEqual(classify("Producto 123", "Ropa > Camisetas"), ("top", "t-shirt"))
        # fuera del MVP: accesorios, medias y lo que no es ropa
        self.assertEqual(classify("Gorra clásica")[0], "accessory")
        self.assertEqual(classify("Pack 3 medias", "Camisetas")[0], "other")
        self.assertEqual(classify("Body splash vainilla")[0], "other")
        self.assertEqual(classify("Calcula tu envío")[0], "other")

    def test_material_uses_whole_words(self):
        self.assertEqual(normalize_material("95% Algodón 5% Elastano"), "cotton/elastane")
        self.assertEqual(normalize_material("Composición tela 1: Poliéster"), "polyester")
        self.assertEqual(normalize_material("Camiseta masculino plana"), "")       # ni "lino" ni "lana"


class NormalizeTests(unittest.TestCase):
    def test_rejects_bad_records_and_merges_sizes(self):
        self.assertIsNone(normalize(RawProduct("1", "", "http://x", 100))[0])
        self.assertIsNone(normalize(RawProduct("1", "Camiseta", "http://x", "sin precio"))[0])
        self.assertIsNone(normalize(RawProduct("1", "Camiseta", "", 100))[0])
        self.assertIsNone(normalize(RawProduct("1", "Camiseta", "http://x", 90_000_000))[0])
        product, _ = normalize(RawProduct("1", "Camiseta negra", "http://x", "$ 59.900",
                                          sizes=[("m", True), ("M", False), ("L", False), ("l", True)]))
        self.assertEqual((product.price_cop, product.color, product.category, product.sizes),
                         (59900, "black", "top", [("M", True), ("L", True)]))
        self.assertEqual((product.pack_size, product.pack_evidence), (1, ""))

    def test_contract_matches_backend_adapter(self):
        raw = RawProduct("77", "<b>Jean</b>  slim azul", "https://shop.co/p/77", "149.900", brand=" DenimLab ",
                         category="Pantalones", description="<p>98% algodón</p>",
                         sizes=[("30", True), ("32", False)],
                         images=["//cdn.shop.co/a.jpg", "https://cdn.shop.co/a.jpg", "ftp://bad", ""])
        item = normalize(raw)[0].to_contract()
        self.assertEqual(set(item), {"external_id", "title", "brand", "category", "subcategory", "color", "material",
                                     "price_cop", "product_url", "description", "images", "sizes"})
        self.assertEqual(item["title"], "Jean slim azul")
        self.assertEqual((item["brand"], item["category"], item["subcategory"]), ("DenimLab", "bottom", "jeans"))
        self.assertEqual((item["color"], item["material"], item["price_cop"]), ("blue", "cotton", 149900))
        self.assertEqual(item["images"], ["https://cdn.shop.co/a.jpg"])
        self.assertEqual(item["sizes"], [{"size": "30", "in_stock": True}, {"size": "32", "in_stock": False}])
        self.assertEqual(item["description"], "98% algodón")

    def test_unknown_color_keeps_store_text(self):
        product, _ = normalize(RawProduct("1", "Camiseta", "http://x", 100, colors=["Tornasol"]))
        self.assertEqual(product.color, "tornasol")
        product, _ = normalize(RawProduct("1", "Camiseta", "http://x", 100))
        self.assertIsNone(product.to_contract()["color"])


class PackTests(unittest.TestCase):
    def test_detect_pack_names_and_api_flags(self):
        # "1 unidad" en este proyecto es UNA prenda, no un pack de varias: casi siempre lo dice el nombre
        for name, expected in [("Pack 3 medias algodón", 3), ("Medias x3", 3), ("Combo Jean + Buzo", 2),
                               ("Kit deportivo completo", 2), ("Juego de 2 toallas", 2), ("2 por camisetas", 2),
                               ("Boxer 3 unidades", 3), ("Set de calzas", 2), ("Medias 3 pares", 3)]:
            self.assertEqual(detect_pack(name)[0], expected, name)
        for name in ["Camiseta oversize negra", "Polo marfil ícono", "Jeans baggy lavandería",
                     "Tenis urbanos: un par cómodo", "Jean 32x34 slim"]:
            self.assertEqual(detect_pack(name)[0], 1, name)
        self.assertEqual(detect_pack("Camiseta", is_kit=True), (2, "isKit"))
        self.assertEqual(detect_pack("Camiseta", unit_multiplier=3), (3, "unitMultiplier=3"))
        self.assertEqual(detect_pack("Camiseta", units_hint=4)[0], 4)
        # normalize lleva el pack al producto (el nombre es más preciso que la marca de la API)
        product, _ = normalize(RawProduct("9", "Pack 3 Medias Básicas", "http://x", 19900,
                                          is_kit=False, unit_multiplier=3.0))
        self.assertEqual((product.pack_size, product.pack_evidence), (3, "name: 'pack 3'"))
        # "rib 2X2" es un tejido, no un pack de dos prendas
        single, _ = normalize(RawProduct("10", "Crop Top Vino Básico", "http://x", 59900,
                                         description="confeccionada en rib 2X2 de 280 gramos"))
        self.assertEqual((single.pack_size, single.pack_evidence), (1, ""))


if __name__ == "__main__":
    unittest.main()
