from abc import ABC, abstractmethod
from typing import Any


class BaseExtractor(ABC):
    """Interfaz base para extractores de tiendas."""

    @abstractmethod
    def extract(self, base_url: str) -> list[dict[str, Any]]:
        """Extrae productos crudos desde la tienda objetivo."""
        raise NotImplementedError
