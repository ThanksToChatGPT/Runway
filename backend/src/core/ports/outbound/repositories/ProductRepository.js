import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/Product.js').Product} Product */
/** @typedef {import('../../catalogQuery.js').Page<Product>} ProductPage */

/**
 * Criterios de búsqueda ya validados y normalizados por el servicio.
 * Todos los filtros se combinan con AND; un filtro vacío/ausente no filtra.
 * Un producto sin el atributo filtrado NO cuenta como coincidencia (BR-07).
 *
 * @typedef {Object} ProductSearchCriteria
 * @property {string|null} [text]               texto libre (nombre, marca, subcategoría).
 * @property {string[]} [ids]                   filtrar por lista de ids de productos.
 * @property {number|null} [minPrice]           COP, inclusive.
 * @property {number|null} [maxPrice]           COP, inclusive.
 * @property {string[]} [brands]                una o más marcas (US-21).
 * @property {string[]} [colors]                colores canónicos (`black`, `navy`…).
 * @property {string[]} [sizes]                 tallas canónicas con `is_available = true`.
 * @property {string[]} [categories]            `top` | `bottom` | `shoes`.
 * @property {string[]} [subcategories]         p. ej. `jeans`, `hoodie`.
 * @property {string[]} [includeStoreIds]       solo estas tiendas (US-26).
 * @property {string[]} [excludeStoreIds]       todas menos estas (US-26).
 * @property {'price_asc'|'price_desc'|null} [sort] ver `PRICE_SORT`.
 * @property {number} page                      empieza en 1.
 * @property {number} pageSize                  ya acotado a `PAGINATION.MAX_PAGE_SIZE`.
 */

/**
 * @typedef {Object} BulkSaveResult
 * @property {number} inserted productos nuevos.
 * @property {number} updated  productos existentes actualizados (precio, tallas, imágenes…).
 */

/**
 * Repositorio del agregado `Product` (tablas `products`, `product_images`,
 * `product_size_stocks`). Siempre devuelve productos completos: con
 * `images` y `sizeStocks` cargados.
 *
 * Las búsquedas para usuarios excluyen productos con `is_hidden = true`
 * y de tiendas inactivas (BR-01).
 */
export class ProductRepository {
  /**
   * Búsqueda con filtros combinados, orden por precio y paginación
   * (FR-13 a FR-18).
   * @param {ProductSearchCriteria} criteria
   * @returns {Promise<ProductPage>}
   */
  async search(criteria) {
    notImplemented('ProductRepository', 'search');
  }

  /**
   * Producto con imágenes y tallas (FR-19). Incluye ocultos: el servicio decide.
   * @param {string} id
   * @returns {Promise<Product|null>}
   */
  async findById(id) {
    notImplemented('ProductRepository', 'findById');
  }

  /**
   * Varios productos por id, para la comparación lado a lado (FR-22) y para
   * armar outfits. Los ids inexistentes se omiten; el orden sigue al de `ids`.
   * @param {string[]} ids
   * @returns {Promise<Product[]>}
   */
  async findByIds(ids) {
    notImplemented('ProductRepository', 'findByIds');
  }

  /**
   * Guarda o actualiza en lote los productos de una tienda, en una transacción.
   * Un producto se identifica por (`storeId`, `externalUrl`). Reemplaza sus
   * imágenes y tallas por las recibidas.
   * @param {string} storeId
   * @param {Product[]} products productos ya estandarizados (BR-02).
   * @returns {Promise<BulkSaveResult>}
   */
  async upsertMany(storeId, products) {
    notImplemented('ProductRepository', 'upsertMany');
  }

  /**
   * Valores disponibles en productos visibles de tiendas activas para poblar
   * los filtros del catálogo (colores, tallas, marcas, subcategorías y rango COP).
   * @param {{ activeStoreIds?: string[] }} [options]
   * @returns {Promise<import('../../inbound/dtos/catalogDtos.js').CatalogFacetsDto>}
   */
  async getFacets(options = {}) {
    notImplemented('ProductRepository', 'getFacets');
  }
}
