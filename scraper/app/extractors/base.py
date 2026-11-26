class BaseAdapter:
    """One adapter knows how to read the products of one kind of store."""
    platform = ""

    def __init__(self, store, client, max_products=None):
        self.store = store
        self.base_url = store["base_url"].rstrip("/")
        self.config = store.get("config") or {}
        self.client = client
        self.max_products = max_products

    def fetch(self):
        """Yield RawProduct objects."""
        raise NotImplementedError
