/**
 * DTOs de administración de tiendas y scraping (AdminStorePort).
 * Toda operación recibe `actor`: el servicio exige `role = 'admin'` (BR-16)
 * y lanza `ForbiddenError` si no lo es.
 */

/** @typedef {import('../../../domain/entities/Store.js').Store} Store */

export const SCRAPING_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
});

// ------------------------------------------------------------------ Entradas

/**
 * Usuario autenticado que ejecuta la acción (sale del token).
 * @typedef {Object} ActorDto
 * @property {string} userId
 * @property {'user'|'admin'} role
 */

/**
 * @typedef {Object} ListStoresInput
 * @property {ActorDto} actor
 */

/**
 * @typedef {Object} CreateStoreInput
 * @property {ActorDto} actor
 * @property {string} name
 * @property {string} baseUrl
 * @property {boolean} [isActive=true]
 */

/**
 * Solo se cambian los campos presentes.
 * @typedef {Object} UpdateStoreInput
 * @property {ActorDto} actor
 * @property {string} storeId
 * @property {string} [name]
 * @property {string} [baseUrl]
 */

/**
 * Estado explícito (no un "toggle" ciego) para que la operación sea idempotente.
 * @typedef {Object} ToggleStoreStatusInput
 * @property {ActorDto} actor
 * @property {string} storeId
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} RunStoreScrapingInput
 * @property {ActorDto} actor
 * @property {string} storeId debe ser una tienda activa (BR-01).
 */

// ------------------------------------------------------------------- Salidas

/**
 * @typedef {Object} StoreDto
 * @property {string} id
 * @property {string} name
 * @property {string} baseUrl
 * @property {boolean} isActive
 * @property {string|null} lastScrapedAt ISO 8601.
 */

/**
 * Resultado de una extracción. Si el scraper falla, el método NO lanza:
 * devuelve `status: 'failed'` con un mensaje claro (RNF-13).
 * @typedef {Object} ScrapingResultDto
 * @property {string} storeId
 * @property {'success'|'failed'} status
 * @property {number} receivedCount   productos crudos recibidos.
 * @property {number} discardedCount  descartados (restringidos, sin categoría MVP o inválidos).
 * @property {number} insertedCount
 * @property {number} updatedCount
 * @property {string} finishedAt      ISO 8601.
 * @property {string|null} message    mensaje para el admin, en español.
 */

// ------------------------------------------------------------------ Mappers

/** @param {Store} store @returns {StoreDto} */
export function toStoreDto(store) {
  return {
    id: store.id,
    name: store.name,
    baseUrl: store.baseUrl,
    isActive: store.isActive,
    lastScrapedAt: store.lastScrapedAt?.toISOString() ?? null,
  };
}
