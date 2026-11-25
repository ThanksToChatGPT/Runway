import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/Store.js').Store} Store */

/**
 * @typedef {Object} StoreListOptions
 * @property {boolean} [onlyActive=false] true = solo tiendas activas (BR-01).
 */

/**
 * Repositorio del agregado `Store` (tabla `stores`).
 */
export class StoreRepository {
  /**
   * Lista tiendas ordenadas por nombre. Son pocas en el MVP, así que también
   * sirve para resolver el nombre de la tienda de cada producto.
   * @param {StoreListOptions} [options]
   * @returns {Promise<Store[]>}
   */
  async findAll(options = {}) {
    notImplemented('StoreRepository', 'findAll');
  }

  /**
   * @param {string} id
   * @returns {Promise<Store|null>}
   */
  async findById(id) {
    notImplemented('StoreRepository', 'findById');
  }

  /**
   * @param {Store} store tienda nueva (`store.id` es null).
   * @returns {Promise<Store>} tienda persistida, con id.
   */
  async create(store) {
    notImplemented('StoreRepository', 'create');
  }

  /**
   * Guarda los cambios de una tienda existente (nombre, URL, `lastScrapedAt`).
   * @param {Store} store
   * @returns {Promise<Store|null>} null si la tienda ya no existe.
   */
  async update(store) {
    notImplemented('StoreRepository', 'update');
  }

  /**
   * Activa o desactiva una tienda (FR-34).
   * @param {string} id
   * @param {boolean} isActive
   * @returns {Promise<Store|null>} null si la tienda no existe.
   */
  async setActive(id, isActive) {
    notImplemented('StoreRepository', 'setActive');
  }
}
