/**
 * Adapter (driving): HTTP ↔ `CatalogSearchPort`.
 *
 * Los query params llegan como texto; aquí solo se convierten a los tipos del
 * DTO (números y listas). La validación de valores la hace el core.
 *
 * @param {import('../../../../core/ports/inbound/CatalogSearchPort.js').CatalogSearchPort} catalogService
 */
export function createCatalogController(catalogService) {
  return {
    async search(req, res) {
      const q = req.query;
      const page = await catalogService.searchProducts({
        text: firstValue(q.q),
        minPrice: toNumber(q.minPrice),
        maxPrice: toNumber(q.maxPrice),
        brands: toList(q.brand),
        colors: toList(q.color),
        sizes: toList(q.size),
        categories: toList(q.category),
        subcategories: toList(q.subcategory),
        includeStoreIds: toList(q.store),
        excludeStoreIds: toList(q.excludeStore),
        sort: firstValue(q.sort),
        page: toNumber(q.page),
        pageSize: toNumber(q.pageSize),
        userId: req.user?.id,
        usePreferredPriceRange: firstValue(q.usePreferences) === 'true',
      });
      res.status(200).json(page);
    },

    async getById(req, res) {
      const detail = await catalogService.getProductDetail({ productId: req.params.id });
      res.status(200).json(detail);
    },

    async compare(req, res) {
      const comparison = await catalogService.compareProducts({ productIds: toList(req.query.ids) });
      res.status(200).json(comparison);
    },

    async facets(_req, res) {
      const facets = await catalogService.getCatalogFacets();
      res.status(200).json(facets);
    },

    async listStores(_req, res) {
      const stores = await catalogService.listActiveStores();
      res.status(200).json(stores);
    },
  };
}

/** `?x=a` o `?x=a&x=b` → primer valor como texto. */
function firstValue(value) {
  if (Array.isArray(value)) return firstValue(value[0]);
  return typeof value === 'string' ? value : undefined;
}

/** Vacío → `undefined`; cualquier otro texto → `Number` (NaN lo rechaza el core). */
function toNumber(value) {
  const text = firstValue(value);
  if (text === undefined || text.trim() === '') return undefined;
  return Number(text);
}

/** Acepta `?x=a,b` y `?x=a&x=b`. */
function toList(value) {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .filter((item) => typeof item === 'string')
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}
