import unittest

import httpx

from app.polite_http import BudgetExhausted, CircuitOpen, FetchError, PoliteClient, RobotsDisallowed
from tests.fake_store import BASE, FakeClock, FakeStore


def make_client(store=None, clock=None, **kwargs):
    store = store or FakeStore()
    clock = clock or FakeClock()
    options = {"delay": 0, "jitter": 0, "retries": 3, "clock": clock, "sleep": clock.sleep}
    options.update(kwargs)
    return PoliteClient("TestBot/1.0", transport=store.transport(), **options), store, clock


class ClientTests(unittest.TestCase):
    def test_robots(self):
        client, _, _ = make_client()
        self.assertTrue(client.allowed(BASE + "/shopify/products.json"))
        with self.assertRaises(RobotsDisallowed):
            client.get(BASE + "/private/x")

    def test_robots_unreadable_blocks_and_missing_allows(self):
        def handler(request):
            status = 503 if request.url.host == "down.store" else 404
            return httpx.Response(status if request.url.path == "/robots.txt" else 200, json={"ok": True})
        client = PoliteClient("TestBot/1.0", delay=0, jitter=0, transport=httpx.MockTransport(handler))
        self.assertEqual(client.get_json("http://norobots.store/x"), {"ok": True})     # 404: todo permitido
        with self.assertRaises(RobotsDisallowed):
            client.get("http://down.store/x")                                          # 5xx: no se arriesga

    def test_retries_on_503(self):
        client, _, clock = make_client(delay=0.5)
        self.assertEqual(client.get_json(BASE + "/flaky"), {"ok": True})
        self.assertEqual(client.requests_made, 3)
        self.assertGreaterEqual(clock.slept, 0.5 + 1.0)         # backoff exponencial entre reintentos

    def test_accepts_206(self):
        client, _, _ = make_client()
        self.assertEqual(client.get(BASE + "/partial").status_code, 206)

    def test_4xx_is_not_retried(self):
        client, store, _ = make_client()
        with self.assertRaises(FetchError) as ctx:
            client.get(BASE + "/forbidden")
        self.assertEqual(ctx.exception.status, 403)
        self.assertEqual(store.paths("/forbidden"), ["/forbidden"])

    def test_circuit_breaker_opens(self):
        client, store, _ = make_client(retries=1, max_failures=2)
        for _ in range(2):
            with self.assertRaises(FetchError):
                client.get(BASE + "/always503")
        with self.assertRaises(CircuitOpen):
            client.get(BASE + "/always503")
        self.assertEqual(len(store.paths("/always503")), 4)      # el circuito abierto ya no pide nada

    def test_rate_limit_between_requests_to_same_host(self):
        client, _, clock = make_client(delay=2.0)
        client.get(BASE + "/partial")
        client.get(BASE + "/partial")
        client.get(BASE + "/partial")
        self.assertAlmostEqual(clock.slept, 4.0)

    def test_time_budget(self):
        clock = FakeClock()
        client, _, _ = make_client(clock=clock, delay=1.0, deadline=clock() + 2.2)
        client.get(BASE + "/partial")
        client.get(BASE + "/partial")                            # espera 1 s: quedan 1.2 s
        with self.assertRaises(BudgetExhausted):
            client.get(BASE + "/partial")                        # esperar 1 s más dejaría menos del mínimo
        self.assertLessEqual(clock() - 1000.0, 2.2)

    def test_network_error_is_retried_then_reported(self):
        client, _, _ = make_client(retries=2, respect_robots=False)
        with self.assertRaises(FetchError) as ctx:
            client.get("http://broken.store/x")
        self.assertIn("giving up", str(ctx.exception))
        self.assertEqual(client.requests_made, 3)

    def test_fetch_bytes_limits_size(self):
        client, _, _ = make_client()
        self.assertTrue(client.fetch_bytes(BASE + "/img/3.svg").startswith(b"<svg"))
        self.assertIsNone(client.fetch_bytes(BASE + "/img/3.svg", max_bytes=10))
        self.assertIsNone(client.fetch_bytes(BASE + "/missing.png"))


if __name__ == "__main__":
    unittest.main()
