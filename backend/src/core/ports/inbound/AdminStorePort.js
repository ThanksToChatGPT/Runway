import { notImplemented } from '../contract.js';

/** @typedef {import('./dtos/adminDtos.js').ListStoresInput} ListStoresInput */
/** @typedef {import('./dtos/adminDtos.js').CreateStoreInput} CreateStoreInput */
/** @typedef {import('./dtos/adminDtos.js').UpdateStoreInput} UpdateStoreInput */
/** @typedef {import('./dtos/adminDtos.js').ToggleStoreStatusInput} ToggleStoreStatusInput */
/** @typedef {import('./dtos/adminDtos.js').RunStoreScrapingInput} RunStoreScrapingInput */
/** @typedef {import('./dtos/adminDtos.js').StoreDto} StoreDto */
/** @typedef {import('./dtos/adminDtos.js').ScrapingResultDto} ScrapingResultDto */

/**
 * Casos de uso del administrador (US-70, US-71, US-74). Solo `role = 'admin'`.
 * Errores esperados: `ForbiddenError`, `ValidationError`, `NotFoundError`.
 */
export class AdminStorePort {
  /**
   * @param {CreateStoreInput} input
   * @returns {Promise<StoreDto>}
   */
  async createStore(input) {
    notImplemented('AdminStorePort', 'createStore');
  }

  /**
   * @param {UpdateStoreInput} input
   * @returns {Promise<StoreDto>}
   */
  async updateStore(input) {
    notImplemented('AdminStorePort', 'updateStore');
  }

  /**
   * Activa o desactiva la tienda. Una tienda inactiva deja de aportar
   * productos al catálogo (BR-01).
   * @param {ToggleStoreStatusInput} input
   * @returns {Promise<StoreDto>}
   */
  async toggleStoreStatus(input) {
    notImplemented('AdminStorePort', 'toggleStoreStatus');
  }

  /**
   * Todas las tiendas (activas e inactivas).
   * @param {ListStoresInput} input
   * @returns {Promise<StoreDto[]>}
   */
  async listStores(input) {
    notImplemented('AdminStorePort', 'listStores');
  }

  /**
   * Extrae productos de una tienda activa, los estandariza (BR-02, BR-13) y
   * los guarda en lote. Un fallo del scraper devuelve `status: 'failed'`
   * en lugar de lanzar, para no afectar al resto del sistema (RNF-13).
   * @param {RunStoreScrapingInput} input
   * @returns {Promise<ScrapingResultDto>}
   */
  async runStoreScraping(input) {
    notImplemented('AdminStorePort', 'runStoreScraping');
  }
}
