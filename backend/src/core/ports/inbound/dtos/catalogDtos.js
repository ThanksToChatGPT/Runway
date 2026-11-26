/**
 * DTOs del catálogo (CatalogSearchPort): búsqueda, detalle y comparación.
 * Todos los montos son COP (FR-23).
 */

/** @typedef {import('../../../domain/entities/Product.js').Product} Product */
/** @typedef {import('../../../domain/entities/Store.js').Store} Store */

// ------------------------------------------------------------------ Entradas

/**
 * Filtros tal como llegan de la API; el servicio los valida, normaliza
 * (colores/tallas canónicos) y acota la paginación.
 *
 * @typedef {Object} SearchProductsInput
 * @property {string} [text]
 * @property {string[]} [ids]
 * @property {number} [minPrice]
 * @property {number} [maxPrice]
 * @property {string[]} [brands]
 * @property {string[]} [colors]
 * @property {string[]} [sizes]
 * @property {string[]} [categories]
 * @property {string[]} [subcategories]
 * @property {string[]} [includeStoreIds]
 * @property {string[]} [excludeStoreIds]
 * @property {'price_asc'|'price_desc'} [sort]
 * @property {number} [page]
 * @property {number} [pageSize]
 * @property {string} [userId]                  usuario autenticado, si lo hay.
 * @property {boolean} [usePreferredPriceRange] aplica el rango de precios guardado (FR-10)
 *                                              cuando no se envían minPrice/maxPrice.
 */

/**
 * @typedef {Object} ProductIdInput
 * @property {string} productId
 */

/**
 * @typedef {Object} CompareProductsInput
 * @property {string[]} productIds entre `MIN_COMPARE_ITEMS` y `MAX_COMPARE_ITEMS` ids distintos.
 */

// ------------------------------------------------------------------- Salidas

/**
 * Tienda de origen visible en cada producto (FR-13).
 * @typedef {Object} StoreRefDto
 * @property {string} id
 * @property {string|null} name
 */

/**
 * Tarjeta de resultado de búsqueda.
 * @typedef {Object} ProductSummaryDto
 * @property {string} id
 * @property {string} name
 * @property {string|null} brand
 * @property {'top'|'bottom'|'shoes'} category
 * @property {string|null} subcategory
 * @property {string|null} color
 * @property {number} priceCop
 * @property {'COP'} currency
 * @property {boolean} isSecondHand
 * @property {string|null} primaryImageUrl
 * @property {string[]} availableSizes
 * @property {string} externalUrl
 * @property {StoreRefDto} store
 */

/**
 * Vista de detalle (FR-19, FR-21) y fila de la comparación (FR-22).
 * @typedef {Object} ProductDetailDto
 * @property {string} id
 * @property {string} name
 * @property {string|null} brand
 * @property {'top'|'bottom'|'shoes'} category
 * @property {string|null} subcategory
 * @property {string|null} material
 * @property {string|null} color
 * @property {number} priceCop
 * @property {'COP'} currency
 * @property {number|null} rating
 * @property {boolean} isSecondHand
 * @property {Array<{ url: string, isPrimary: boolean }>} images
 * @property {Array<{ size: string, isAvailable: boolean }>} sizes
 * @property {string} externalUrl
 * @property {string|null} lastPriceUpdate ISO 8601.
 * @property {StoreRefDto} store
 */

/**
 * @typedef {Object} ProductPageDto
 * @property {ProductSummaryDto[]} items
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalItems
 * @property {number} totalPages
 */

/**
 * @typedef {Object} ProductComparisonDto
 * @property {ProductDetailDto[]} products en el mismo orden en que se pidieron.
 */

/**
 * @typedef {Object} PublicStoresDto
 * @property {StoreRefDto[]} items tiendas activas visibles en el catálogo.
 */

/**
 * @typedef {Object} CatalogFacetsDto
 * @property {string[]} colors
 * @property {string[]} sizes
 * @property {string[]} brands
 * @property {string[]} subcategories
 * @property {{ min: number|null, max: number|null }} priceRange
 */

// ------------------------------------------------------------------ Mappers

/**
 * @param {string} storeId
 * @param {Map<string, Store>|undefined} storesById
 * @returns {StoreRefDto}
 */
export function toStoreRefDto(storeId, storesById) {
  return { id: storeId, name: storesById?.get(storeId)?.name ?? null };
}

/**
 * @param {Product} product
 * @param {Map<string, Store>} [storesById]
 * @returns {ProductSummaryDto}
 */
export function toProductSummaryDto(product, storesById) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    color: product.color,
    priceCop: product.priceCop,
    currency: 'COP',
    isSecondHand: product.isSecondHand,
    primaryImageUrl: product.getPrimaryImage()?.imageUrl ?? null,
    availableSizes: product.getAvailableSizes(),
    externalUrl: product.externalUrl,
    store: toStoreRefDto(product.storeId, storesById),
  };
}

/**
 * @param {Product} product
 * @param {Map<string, Store>} [storesById]
 * @returns {ProductDetailDto}
 */
export function toProductDetailDto(product, storesById) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    material: product.material,
    color: product.color,
    priceCop: product.priceCop,
    currency: 'COP',
    rating: product.rating,
    isSecondHand: product.isSecondHand,
    images: product.images.map((img) => ({ url: img.imageUrl, isPrimary: img.isPrimary })),
    sizes: product.sizeStocks.map((s) => ({ size: s.size, isAvailable: s.isAvailable })),
    externalUrl: product.externalUrl,
    lastPriceUpdate: product.lastPriceUpdate?.toISOString() ?? null,
    store: toStoreRefDto(product.storeId, storesById),
  };
}

/**
 * @param {import('../../catalogQuery.js').Page<Product>} page
 * @param {Map<string, Store>} [storesById]
 * @returns {ProductPageDto}
 */
export function toProductPageDto(page, storesById) {
  return {
    items: page.items.map((product) => toProductSummaryDto(product, storesById)),
    page: page.page,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  };
}
