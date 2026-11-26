import { DomainError, ValidationError } from '../domain/errors.js';
import { isHttpUrl, requireId } from '../domain/guards.js';
import { Product } from '../domain/entities/Product.js';
import { Store } from '../domain/entities/Store.js';
import { standardizeCatalogItem } from '../domain/rules/catalogStandardizer.js';
import { AdminStorePort } from '../ports/inbound/AdminStorePort.js';
import { SCRAPING_STATUS, toStoreDto } from '../ports/inbound/dtos/adminDtos.js';
import { requireAdmin, requireFound } from './applicationGuards.js';

const STORE_NOT_FOUND = 'No encontramos esa tienda.';
const SCRAPER_FAILED =
  'No pudimos obtener los productos de la tienda en este momento. El catálogo actual no se modificó; inténtalo más tarde.';

/**
 * Casos de uso del administrador: tiendas y actualización del catálogo.
 * Implementa `AdminStorePort`; recibe sus dependencias por constructor.
 */
export class AdminStoreService extends AdminStorePort {
  #stores;
  #products;
  #scraper;
  #now;

  /**
   * @param {Object} deps
   * @param {import('../ports/outbound/repositories/StoreRepository.js').StoreRepository} deps.storeRepository
   * @param {import('../ports/outbound/repositories/ProductRepository.js').ProductRepository} deps.productRepository
   * @param {import('../ports/outbound/extraction/ScraperPort.js').ScraperPort} deps.scraper
   * @param {() => Date} [deps.now] reloj inyectable (útil en tests).
   */
  constructor({ storeRepository, productRepository, scraper, now = () => new Date() }) {
    super();
    this.#stores = storeRepository;
    this.#products = productRepository;
    this.#scraper = scraper;
    this.#now = now;
  }

  async createStore({ actor, name, baseUrl, isActive = true } = {}) {
    requireAdmin(actor);
    const store = await this.#stores.create(new Store({ name, baseUrl, isActive }));
    return toStoreDto(store);
  }

  async updateStore({ actor, storeId, name, baseUrl } = {}) {
    requireAdmin(actor);
    const store = await this.#findStore(storeId);
    store.updateDetails({ name, baseUrl });
    const updated = requireFound(await this.#stores.update(store), STORE_NOT_FOUND);
    return toStoreDto(updated);
  }

  async toggleStoreStatus({ actor, storeId, isActive } = {}) {
    requireAdmin(actor);
    requireStoreId(storeId);
    if (typeof isActive !== 'boolean') {
      throw new ValidationError('Indica si la tienda debe quedar activa o inactiva.', { field: 'isActive' });
    }
    const updated = requireFound(await this.#stores.setActive(storeId, isActive), STORE_NOT_FOUND);
    return toStoreDto(updated);
  }

  async listStores({ actor } = {}) {
    requireAdmin(actor);
    const stores = await this.#stores.findAll();
    return stores.map(toStoreDto);
  }

  async runStoreScraping({ actor, storeId } = {}) {
    requireAdmin(actor);
    const store = await this.#findStore(storeId);
    if (!store.isActive) {
      throw new ValidationError('La tienda está inactiva. Actívala antes de actualizar su catálogo.', {
        field: 'storeId',
      });
    }

    // Un fallo del scraper no debe tumbar el sistema ni tocar el catálogo (RNF-13).
    let rawItems;
    try {
      rawItems = await this.#scraper.extractProductsByStore(store);
      if (!Array.isArray(rawItems)) throw new Error('Respuesta del scraper inválida.');
    } catch {
      return this.#result(store, SCRAPING_STATUS.FAILED, { message: SCRAPER_FAILED });
    }

    const scrapedAt = this.#now();
    const products = rawItems.map((raw) => toCatalogProduct(raw, store.id, scrapedAt)).filter(Boolean);
    const { inserted, updated } =
      products.length > 0 ? await this.#products.upsertMany(store.id, products) : { inserted: 0, updated: 0 };

    store.markScraped(scrapedAt);
    await this.#stores.update(store);

    const discarded = rawItems.length - products.length;
    return this.#result(store, SCRAPING_STATUS.SUCCESS, {
      receivedCount: rawItems.length,
      discardedCount: discarded,
      insertedCount: inserted,
      updatedCount: updated,
      message: `Catálogo actualizado: ${inserted} nuevos, ${updated} actualizados y ${discarded} descartados.`,
    });
  }

  async #findStore(storeId) {
    requireStoreId(storeId);
    return requireFound(await this.#stores.findById(storeId), STORE_NOT_FOUND);
  }

  #result(store, status, { receivedCount = 0, discardedCount = 0, insertedCount = 0, updatedCount = 0, message }) {
    return {
      storeId: store.id,
      status,
      receivedCount,
      discardedCount,
      insertedCount,
      updatedCount,
      finishedAt: this.#now().toISOString(),
      message,
    };
  }
}

function requireStoreId(storeId) {
  return requireId(storeId, 'Indica la tienda.', 'storeId');
}

/**
 * Ítem crudo → `Product` estandarizado (BR-02, BR-13), o null si debe
 * descartarse: contenido restringido, categoría fuera del MVP o datos inválidos.
 */
function toCatalogProduct(raw, storeId, scrapedAt) {
  const item = standardizeCatalogItem(raw);
  if (!item) return null;

  const imageUrls = (item.imageUrls ?? []).filter(isHttpUrl);
  try {
    return new Product({
      storeId,
      name: item.name,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      material: item.material,
      color: item.color,
      priceCop: item.priceCop,
      rating: item.rating,
      isSecondHand: item.isSecondHand,
      externalUrl: item.externalUrl,
      lastPriceUpdate: scrapedAt,
      images: imageUrls.map((imageUrl, index) => ({ imageUrl, isPrimary: index === 0 })),
      sizeStocks: item.sizes.map((size) => ({ size, isAvailable: true })),
    });
  } catch (error) {
    if (error instanceof DomainError) return null; // dato inválido: se descarta solo este ítem
    throw error;
  }
}
