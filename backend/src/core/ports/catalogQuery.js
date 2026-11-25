/**
 * Vocabulario compartido por los puertos de catálogo (entrante y saliente):
 * orden por precio y paginación (FR-16, FR-18).
 */

export const PRICE_SORT = Object.freeze({
  ASC: 'price_asc',
  DESC: 'price_desc',
});
export const PRICE_SORT_VALUES = Object.freeze(Object.values(PRICE_SORT));

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
});

/** Mínimo de productos para una comparación lado a lado (FR-22). */
export const MIN_COMPARE_ITEMS = 2;
/** Máximo razonable de productos en la tabla comparativa del MVP. */
export const MAX_COMPARE_ITEMS = 4;

/**
 * Página de resultados. `page` empieza en 1.
 * @template T
 * @typedef {Object} Page
 * @property {T[]} items
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalItems
 * @property {number} totalPages
 */
