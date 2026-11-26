/**
 * Data Mapper: traduce filas `snake_case` de PostgreSQL a entidades `camelCase`
 * del dominio. Es el único lugar que conoce los nombres de las columnas
 * fuera de las consultas SQL.
 */
import {
  Outfit,
  Product,
  Store,
  User,
  UserPreference,
} from '../../../core/domain/index.js';

/** `NUMERIC` llega como string desde `pg`: se convierte a Number (o null). */
export function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toUser(row) {
  if (!row) return null;
  return new User({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider,
    name: row.name,
    country: row.country,
    role: row.role,
  });
}

export function toUserPreference(row) {
  if (!row) return null;
  return new UserPreference({
    id: row.id,
    userId: row.user_id,
    minPrice: toNumberOrNull(row.min_price),
    maxPrice: toNumberOrNull(row.max_price),
    maxOutfitBudget: toNumberOrNull(row.max_outfit_budget),
  });
}

export function toStore(row) {
  if (!row) return null;
  return new Store({
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    isActive: row.is_active,
    lastScrapedAt: row.last_scraped_at,
  });
}

/**
 * @param {object} row fila de `products`.
 * @param {object[]} imageRows filas de `product_images` del producto, ya ordenadas.
 * @param {object[]} sizeRows filas de `product_size_stocks` del producto.
 */
export function toProduct(row, imageRows = [], sizeRows = []) {
  if (!row) return null;
  return new Product({
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    material: row.material,
    color: row.color,
    priceCop: toNumberOrNull(row.price_cop),
    rating: toNumberOrNull(row.rating),
    isSecondHand: row.is_second_hand,
    externalUrl: row.external_url,
    lastPriceUpdate: row.last_price_update,
    isHidden: row.is_hidden,
    images: imageRows.map((image) => ({
      id: image.id,
      productId: image.product_id,
      imageUrl: image.image_url,
      isPrimary: image.is_primary,
    })),
    sizeStocks: sizeRows.map((size) => ({
      id: size.id,
      productId: size.product_id,
      size: size.size,
      isAvailable: size.is_available,
    })),
  });
}

/**
 * Rehidrata un outfit guardado.
 *
 * Las prendas se colocan directamente en cada sección (sin `assign`), porque
 * se validaron al guardar: una prenda que después se ocultó debe seguir
 * apareciendo en "Mis outfits" en vez de romper la lectura. El total y el
 * aviso de presupuesto quedan tal como se persistieron.
 *
 * @param {object} row fila de `outfits`.
 * @param {object[]} slotRows filas de `outfit_slots` del outfit.
 * @param {Map<string, Product>} productsById prendas ya cargadas.
 */
export function toOutfit(row, slotRows, productsById) {
  if (!row) return null;
  const outfit = new Outfit({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
  });
  for (const slotRow of slotRows) {
    const slot = outfit.getSlot(slotRow.slot_type);
    slot.id = slotRow.id;
    slot.product = slotRow.product_id ? productsById.get(slotRow.product_id) ?? null : null;
  }
  outfit.totalCostCop = toNumberOrNull(row.total_cost_cop) ?? 0;
  outfit.isOverBudget = row.is_over_budget;
  return outfit;
}
