import { notImplemented } from '../contract.js';

/** @typedef {import('./dtos/catalogDtos.js').SearchProductsInput} SearchProductsInput */
/** @typedef {import('./dtos/catalogDtos.js').ProductIdInput} ProductIdInput */
/** @typedef {import('./dtos/catalogDtos.js').CompareProductsInput} CompareProductsInput */
/** @typedef {import('./dtos/catalogDtos.js').ProductPageDto} ProductPageDto */
/** @typedef {import('./dtos/catalogDtos.js').ProductDetailDto} ProductDetailDto */
/** @typedef {import('./dtos/catalogDtos.js').ProductComparisonDto} ProductComparisonDto */
/** @typedef {import('./dtos/catalogDtos.js').CatalogFacetsDto} CatalogFacetsDto */
/** @typedef {import('./dtos/catalogDtos.js').PublicStoresDto} PublicStoresDto */

/**
 * Casos de uso del catálogo (US-18 a US-43).
 * Errores esperados: `ValidationError` (filtros inválidos), `NotFoundError`.
 */
export class CatalogSearchPort {
  /**
   * Texto libre + filtros combinados + orden por precio + paginación
   * (FR-13 a FR-18). Cada resultado incluye su tienda de origen.
   * @param {SearchProductsInput} input
   * @returns {Promise<ProductPageDto>}
   */
  async searchProducts(input) {
    notImplemented('CatalogSearchPort', 'searchProducts');
  }

  /**
   * Detalle con galería, tallas disponibles/no disponibles y enlace externo
   * (FR-19, FR-21). Un producto oculto responde `NotFoundError`.
   * @param {ProductIdInput} input
   * @returns {Promise<ProductDetailDto>}
   */
  async getProductDetail(input) {
    notImplemented('CatalogSearchPort', 'getProductDetail');
  }

  /**
   * Comparación lado a lado de 2 o más productos (FR-22).
   * @param {CompareProductsInput} input
   * @returns {Promise<ProductComparisonDto>}
   */
  async compareProducts(input) {
    notImplemented('CatalogSearchPort', 'compareProducts');
  }

  /**
   * Lista pública de tiendas activas para filtros del catálogo.
   * @returns {Promise<PublicStoresDto>}
   */
  async listActiveStores() {
    notImplemented('CatalogSearchPort', 'listActiveStores');
  }

  /**
   * Facetas disponibles del catálogo (colores, tallas, marcas, subcategorías y rango COP).
   * @returns {Promise<CatalogFacetsDto>}
   */
  async getCatalogFacets() {
    notImplemented('CatalogSearchPort', 'getCatalogFacets');
  }
}
