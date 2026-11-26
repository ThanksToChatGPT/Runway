from abc import ABC, abstractmethod
from typing import Iterator

from app.models import RawProduct
from app.polite_http import BudgetExhausted, ScraperError


class ConfigError(ValueError):
    """La configuración del extractor no sirve (p. ej. una tienda `html` sin selectores)."""


class BaseExtractor(ABC):
    """Un extractor sabe leer los productos de un tipo de tienda (plataforma)."""

    platform = ""

    def __init__(self, base_url, client, config=None, max_products=None):
        self.base_url = base_url.rstrip("/")
        self.client = client
        self.config = config or {}
        self.max_products = max_products
        self.parse_errors = []

    @abstractmethod
    def fetch(self) -> Iterator[RawProduct]:
        """Produce `RawProduct` de forma perezosa: dejar de iterar deja de hacer peticiones."""
        raise NotImplementedError

    def _parse(self, item) -> RawProduct:
        raise NotImplementedError

    def _safe_parse(self, item):
        """Un producto con datos raros no debe tumbar toda la tienda: se omite y se anota."""
        try:
            return self._parse(item)
        except (BudgetExhausted, ScraperError):
            raise
        except (AttributeError, KeyError, TypeError, ValueError) as exc:
            self.parse_errors.append(f"producto ilegible: {exc}")
            return None

    def _int_config(self, key, default):
        try:
            return int(self.config.get(key, default))
        except (TypeError, ValueError) as exc:
            raise ConfigError(f"'{key}' debe ser un número entero") from exc
