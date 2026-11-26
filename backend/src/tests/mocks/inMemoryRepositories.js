/**
 * Repositorios en memoria (test doubles) que cumplen los puertos salientes.
 * Guardan entidades del dominio en un Map y asignan ids secuenciales.
 */
import {
  OutfitRepository,
  PreferenceRepository,
  ProductRepository,
  StoreRepository,
  UserRepository,
} from '../../core/ports/index.js';
import { Outfit } from '../../core/domain/entities/Outfit.js';
import { ConflictError } from '../../core/domain/errors.js';

function sequence(prefix) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

export class InMemoryUserRepository extends UserRepository {
  #byId = new Map();
  #nextId = sequence('user');

  async findByEmail(email) {
    return [...this.#byId.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id) {
    return this.#byId.get(id) ?? null;
  }

  async create(user) {
    if (await this.findByEmail(user.email)) throw new ConflictError();
    user.id = this.#nextId();
    this.#byId.set(user.id, user);
    return user;
  }

  get size() {
    return this.#byId.size;
  }
}

export class InMemoryPreferenceRepository extends PreferenceRepository {
  #byUserId = new Map();
  #nextId = sequence('pref');

  async findByUserId(userId) {
    return this.#byUserId.get(userId) ?? null;
  }

  async upsert(preference) {
    preference.id ??= this.#nextId();
    this.#byUserId.set(preference.userId, preference);
    return preference;
  }
}

export class InMemoryStoreRepository extends StoreRepository {
  #byId = new Map();
  #nextId = sequence('store');

  async findAll({ onlyActive = false } = {}) {
    return [...this.#byId.values()]
      .filter((store) => !onlyActive || store.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id) {
    return this.#byId.get(id) ?? null;
  }

  async create(store) {
    store.id = this.#nextId();
    this.#byId.set(store.id, store);
    return store;
  }

  async update(store) {
    if (!this.#byId.has(store.id)) return null;
    this.#byId.set(store.id, store);
    return store;
  }

  async setActive(id, isActive) {
    const store = this.#byId.get(id);
    if (!store) return null;
    return isActive ? store.activate() : store.deactivate();
  }
}

/**
 * Implementa la búsqueda con los mismos criterios que tendrá el SQL:
 * filtros combinados con AND, ocultos excluidos, orden por precio y paginación.
 */
export class InMemoryProductRepository extends ProductRepository {
  #byId = new Map();
  #nextId = sequence('product');
  /** Criterios recibidos en la última búsqueda (para verificar al servicio). */
  lastCriteria = null;

  /** Precarga productos (fixtures) asignando id si no lo tienen. */
  seed(...products) {
    for (const product of products) {
      product.id ??= this.#nextId();
      this.#byId.set(product.id, product);
    }
    return products;
  }

  all() {
    return [...this.#byId.values()];
  }

  async search(criteria) {
    this.lastCriteria = criteria;
    const has = (list) => Array.isArray(list) && list.length > 0;
    const text = criteria.text?.toLowerCase();

    let items = this.all().filter((p) => {
      if (p.isHidden) return false;
      if (has(criteria.ids) && !criteria.ids.includes(String(p.id))) return false;
      if (text && ![p.name, p.brand, p.subcategory].some((field) => field?.toLowerCase().includes(text))) return false;
      if (criteria.minPrice != null && p.priceCop < criteria.minPrice) return false;
      if (criteria.maxPrice != null && p.priceCop > criteria.maxPrice) return false;
      if (has(criteria.brands) && !criteria.brands.includes(p.brand)) return false;
      if (has(criteria.colors) && !criteria.colors.includes(p.color)) return false;
      if (has(criteria.sizes) && !criteria.sizes.some((size) => p.getAvailableSizes().includes(size))) return false;
      if (has(criteria.categories) && !criteria.categories.includes(p.category)) return false;
      if (has(criteria.subcategories) && !criteria.subcategories.includes(p.subcategory)) return false;
      if (has(criteria.includeStoreIds) && !criteria.includeStoreIds.includes(p.storeId)) return false;
      if (has(criteria.excludeStoreIds) && criteria.excludeStoreIds.includes(p.storeId)) return false;
      return true;
    });

    if (criteria.sort === 'price_asc') items.sort((a, b) => a.priceCop - b.priceCop);
    if (criteria.sort === 'price_desc') items.sort((a, b) => b.priceCop - a.priceCop);

    const { page, pageSize } = criteria;
    const totalItems = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async findById(id) {
    return this.#byId.get(id) ?? null;
  }

  async findByIds(ids) {
    return ids.map((id) => this.#byId.get(id)).filter(Boolean);
  }

  async upsertMany(storeId, products) {
    let inserted = 0;
    let updated = 0;
    for (const product of products) {
      const existing = this.all().find((p) => p.storeId === storeId && p.externalUrl === product.externalUrl);
      if (existing) {
        product.id = existing.id;
        updated += 1;
      } else {
        product.id = this.#nextId();
        inserted += 1;
      }
      this.#byId.set(product.id, product);
    }
    return { inserted, updated };
  }

  async getFacets({ activeStoreIds } = {}) {
    const allowedStores = Array.isArray(activeStoreIds) ? new Set(activeStoreIds) : null;
    const visible = this.all().filter((p) => !p.isHidden && (!allowedStores || allowedStores.has(p.storeId)));
    const uniq = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const prices = visible.map((p) => p.priceCop);
    return {
      colors: uniq(visible.map((p) => p.color)),
      sizes: uniq(visible.flatMap((p) => p.getAvailableSizes())),
      brands: uniq(visible.map((p) => p.brand)),
      subcategories: uniq(visible.map((p) => p.subcategory)),
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : null,
        max: prices.length > 0 ? Math.max(...prices) : null,
      },
    };
  }
}

export class InMemoryOutfitRepository extends OutfitRepository {
  #byId = new Map();
  #persisted = new Map();
  #nextId = sequence('outfit');

  /** Devuelve una instancia nueva, como haría la base de datos al leer. */
  async create(outfit) {
    const id = this.#nextId();
    const saved = new Outfit({
      id,
      userId: outfit.userId,
      name: outfit.name,
      slots: outfit.slots.map((slot) => ({ slotType: slot.slotType, product: slot.product })),
      createdAt: new Date(),
    });
    this.#persisted.set(id, { totalCostCop: outfit.totalCostCop, isOverBudget: outfit.isOverBudget });
    this.#byId.set(id, saved);
    return saved;
  }

  async findByUserId(userId) {
    return [...this.#byId.values()].filter((outfit) => outfit.userId === userId).reverse();
  }

  async findByIdForUser(outfitId, userId) {
    const outfit = this.#byId.get(outfitId);
    return outfit && outfit.userId === userId ? outfit : null;
  }

  /** Solo para tests: total e `isOverBudget` tal como llegaron a guardarse. */
  persistedValues(id) {
    return this.#persisted.get(id) ?? null;
  }
}
