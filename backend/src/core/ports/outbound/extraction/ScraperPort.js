import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/Store.js').Store} Store */

/**
 * Producto tal como lo entrega el servicio de extracción, ANTES de estandarizar.
 * El adaptador solo traduce nombres de campos (snake_case → camelCase);
 * la limpieza la hace el core con `catalogStandardizer` (BR-02, BR-13).
 *
 * @typedef {Object} RawScrapedProduct
 * @property {string} name
 * @property {string} externalUrl           URL del producto en la tienda (BR-10).
 * @property {number} priceCop
 * @property {string|null} [brand]
 * @property {string|null} [category]       texto libre de la tienda ("Camisetas", "Tenis"…).
 * @property {string|null} [subcategory]
 * @property {string|null} [material]
 * @property {string|null} [color]          texto libre ("Negro", "BLK"…).
 * @property {number|null} [rating]         0 a 5.
 * @property {boolean} [isSecondHand]       BR-14.
 * @property {string|null} [description]    solo se usa para filtrar contenido restringido.
 * @property {string[]} [imageUrls]         la primera se toma como principal.
 * @property {string[]} [sizes]             tallas disponibles, texto libre ("Mediana", "38,5"…).
 */

/**
 * Puerto de extracción de datos: pide al servicio de Python los productos
 * de una tienda activa.
 *
 * Si el servicio falla o no responde, lanza un error; el servicio de
 * aplicación lo aísla para no afectar el catálogo existente (RNF-13, BR-12).
 */
export class ScraperPort {
  /**
   * @param {Store} store tienda activa (usa `id`, `name` y `baseUrl`).
   * @returns {Promise<RawScrapedProduct[]>}
   */
  async extractProductsByStore(store) {
    notImplemented('ScraperPort', 'extractProductsByStore');
  }
}
