import { CATEGORY_VALUES } from '../domain/constants.js';
import { NotFoundError, ValidationError } from '../domain/errors.js';
import { optionalCop, requireId, requireOneOf } from '../domain/guards.js';
import { normalizeColor, normalizeSize, normalizeText } from '../domain/rules/catalogStandardizer.js';
import {
  MAX_COMPARE_ITEMS,
  MIN_COMPARE_ITEMS,
  PAGINATION,
  PRICE_SORT_VALUES,
} from '../ports/catalogQuery.js';
import { CatalogSearchPort } from '../ports/inbound/CatalogSearchPort.js';
import { toProductDetailDto, toProductPageDto } from '../ports/inbound/dtos/catalogDtos.js';
import { indexStoresById } from './applicationGuards.js';

const PRODUCT_NOT_FOUND = 'Este producto no existe o ya no está disponible.';

/**
 * Casos de uso del catálogo: búsqueda, detalle y comparación.
 * Implementa `CatalogSearchPort`; recibe sus dependencias por constructor.
 */
export class CatalogSearchService extends CatalogSearchPort {
  #products;
  #stores;
  #preferences;

  /**
   * @param {Object} deps
   * @param {import('../ports/outbound/repositories/ProductRepository.js').ProductRepository} deps.productRepository
   * @param {import('../ports/outbound/repositories/StoreRepository.js').StoreRepository} deps.storeRepository
   * @param {import('../ports/outbound/repositories/PreferenceRepository.js').PreferenceRepository} deps.preferenceRepository
   */
  constructor({ productRepository, storeRepository, preferenceRepository }) {
    super();
    this.#products = productRepository;
    this.#stores = storeRepository;
    this.#preferences = preferenceRepository;
  }

  async searchProducts(input = {}) {
    const criteria = buildCriteria(input);

    // FR-10: si no se envió rango, se puede usar el guardado en las preferencias.
    if (input.usePreferredPriceRange && input.userId && criteria.minPrice === null && criteria.maxPrice === null) {
      const preference = await this.#preferences.findByUserId(input.userId);
      criteria.minPrice = preference?.minPrice ?? null;
      criteria.maxPrice = preference?.maxPrice ?? null;
    }

    const page = await this.#products.search(criteria);
    const visible = { ...page, items: page.items.filter((product) => !product.isHidden) };
    return toProductPageDto(visible, indexStoresById(await this.#stores.findAll()));
  }

  async getProductDetail({ productId } = {}) {
    requireId(productId, 'Indica el producto que quieres ver.', 'productId');
    const product = await this.#products.findById(productId);
    if (!product || product.isHidden) throw new NotFoundError(PRODUCT_NOT_FOUND);

    const store = await this.#stores.findById(product.storeId);
    return toProductDetailDto(product, indexStoresById([store]));
  }

  async compareProducts({ productIds } = {}) {
    const ids = [...new Set((Array.isArray(productIds) ? productIds : []).map(String).map((id) => id.trim()))]
      .filter(Boolean);
    if (ids.length < MIN_COMPARE_ITEMS || ids.length > MAX_COMPARE_ITEMS) {
      throw new ValidationError(
        `Selecciona entre ${MIN_COMPARE_ITEMS} y ${MAX_COMPARE_ITEMS} productos distintos para compararlos.`,
        { field: 'productIds' },
      );
    }

    const byId = new Map((await this.#products.findByIds(ids)).map((product) => [String(product.id), product]));
    const products = ids.map((id) => byId.get(id));
    if (products.some((product) => !product || product.isHidden)) {
      throw new NotFoundError('Alguno de los productos que quieres comparar ya no está disponible.');
    }

    const stores = indexStoresById(await this.#stores.findAll());
    return { products: products.map((product) => toProductDetailDto(product, stores)) };
  }
}

/** Valida y normaliza los filtros de la API en `ProductSearchCriteria`. */
function buildCriteria(input) {
  const minPrice = optionalCop(input.minPrice, 'El precio mínimo debe ser un valor en pesos igual o mayor a 0.', 'minPrice');
  const maxPrice = optionalCop(input.maxPrice, 'El precio máximo debe ser un valor en pesos igual o mayor a 0.', 'maxPrice');
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new ValidationError('El precio mínimo no puede ser mayor que el precio máximo.', { field: 'minPrice' });
  }

  const sort = input.sort ?? null;
  if (sort !== null) {
    requireOneOf(sort, PRICE_SORT_VALUES, 'Ordena por precio de menor a mayor o de mayor a menor.', 'sort');
  }

  const categories = toList(input.categories).map((category) =>
    requireOneOf(
      category,
      CATEGORY_VALUES,
      'La categoría no es válida. Usa parte superior, parte inferior o calzado.',
      'categories',
    ),
  );

  const text = typeof input.text === 'string' && input.text.trim() ? input.text.trim() : null;

  return {
    text,
    minPrice,
    maxPrice,
    brands: toList(input.brands),
    colors: toList(input.colors).map(normalizeColor).filter(Boolean),
    sizes: toList(input.sizes).map(normalizeSize).filter(Boolean),
    categories,
    subcategories: toList(input.subcategories).map(normalizeText).filter(Boolean),
    includeStoreIds: toList(input.includeStoreIds),
    excludeStoreIds: toList(input.excludeStoreIds),
    sort,
    page: toPositiveInt(input.page, PAGINATION.DEFAULT_PAGE),
    pageSize: Math.min(toPositiveInt(input.pageSize, PAGINATION.DEFAULT_PAGE_SIZE), PAGINATION.MAX_PAGE_SIZE),
  };
}

/** Lista de textos sin vacíos ni repetidos. */
function toList(value) {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}
