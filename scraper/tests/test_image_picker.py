import unittest

from app import image_picker
from tests import fake_store


class ImagePickerTests(unittest.TestCase):
    def test_hints_in_names(self):
        ordered, _ = image_picker.pick_images(["https://x/model-1.jpg", "https://x/flat-1.jpg"])
        self.assertEqual(ordered[0], "https://x/flat-1.jpg")
        ordered, _ = image_picker.pick_images(["https://x/1.jpg", "https://x/2.jpg"], {"https://x/2.jpg": "Producto frente"})
        self.assertEqual(ordered[0], "https://x/2.jpg")
        self.assertEqual(image_picker.pick_images(["https://x/1.jpg"])[0], ["https://x/1.jpg"])
        self.assertEqual(image_picker.pick_images([]), ([], {}))

    def test_vtex_front_shot_goes_first_and_no_duplicates(self):
        # VTEX nombra las fotos "ref-1.jpg" (frente), "ref-2.jpg" (detalle), "ref-3.jpg" (espalda)
        urls = [f"https://cdn.x/arquivos/ids/{73000 + i}/95964-{i}.jpg?v=6392819{i}" for i in (3, 2, 1, 3, 2)]
        ordered, kinds = image_picker.pick_images(urls)
        self.assertEqual(len(ordered), 3)                       # la misma foto con otro ?v= no se repite
        self.assertIn("95964-1.jpg", ordered[0])
        self.assertEqual(kinds[ordered[0]], "product-only")
        self.assertEqual(image_picker.meta_score("https://cdn.x/ids/71/95964-1.jpg"), 3)
        self.assertLess(image_picker.meta_score("https://cdn.x/ids/71/95964-2.jpg"), 3)

    def test_at_most_eight_photos(self):
        ordered, _ = image_picker.pick_images([f"https://x/{i}.jpg" for i in range(20)])
        self.assertEqual(len(ordered), 8)

    def test_strong_hint_skips_downloads(self):
        calls = []
        ordered, _ = image_picker.pick_images(["https://x/ids/1/9-2.jpg", "https://x/ids/1/9-1.jpg"],
                                              fetch_bytes=lambda u: calls.append(u))
        self.assertIn("9-1.jpg", ordered[0])
        self.assertEqual(calls, [])

    @unittest.skipUnless(image_picker.HAVE_PIL and fake_store.HAVE_PIL, "necesita Pillow")
    def test_looking_at_the_pixels(self):
        kinds = {k: image_picker.classify(image_picker.analyze(fake_store.png(k, 7)))[0] for k in "abc"}
        self.assertEqual(kinds, {"a": "model", "b": "product-only", "c": "other"})

    @unittest.skipUnless(image_picker.HAVE_PIL and fake_store.HAVE_PIL, "necesita Pillow")
    def test_garment_alone_goes_first_with_pixels(self):
        images = {f"https://x/{k}.png": fake_store.png(k, 3) for k in "acb"}
        ordered, kinds = image_picker.pick_images(list(images), fetch_bytes=images.get)
        self.assertEqual(ordered[0], "https://x/b.png")
        self.assertEqual(kinds, {"https://x/b.png": "product-only", "https://x/a.png": "model",
                                 "https://x/c.png": "other"})


if __name__ == "__main__":
    unittest.main()
