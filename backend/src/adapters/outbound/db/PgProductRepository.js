import { ProductRepository, PRICE_SORT } from '../../../core/ports/index.js';
import { getPool } from './pool.js';
import { toNumberOrNull, toProduct } from './mappers.js';
import { escapeLike, isUuid, withTransaction } from './sqlHelpers.js';

const PRODUCT_COLUMNS = `p.id, p.store_id, p.name, p.brand, p.category, p.subcategory, p.material,
  p.color, p.price_cop, p.rating, p.is_second_hand, p.external_url, p.last_price_update, p.is_hidden`;

/**
 * Lista blanca de ordenamientos: el ORDER BY nunca se arma con texto del usuario.
 * `p.id` desempata para que la paginación sea estable.
 */
const ORDER_BY = Object.freeze({
  [PRICE_SORT.ASC]: 'p.price_cop ASC, p.id ASC',
  [PRICE_SORT.DESC]: 'p.price_cop DESC, p.id ASC',
  default: 'p.name ASC, p.id ASC',
});

const hasItems = (list) => Array.isArray(list) && list.length > 0;

/**
 * Carga productos completos (con imágenes y tallas) por id. Incluye ocultos.
 * Lo comparten `PgProductRepository` y `PgOutfitRepository`.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string[]} ids
 * @returns {Promise<Map<string, import('../../../core/domain/index.js').Product>>}
 */
export async function loadProductsByIds(db, ids) {
  const validIds = [...new Set(ids.filter(isUuid))];
  if (validIds.length === 0) return new Map();

  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.id = ANY($1::uuid[])`,
    [validIds],
  );
  return hydrate(db, rows);
}

/** Filas de `products` → Map(id → Product) con 2 consultas extra en total (sin N+1). */
async function hydrate(db, productRows) {
  const byId = new Map();
  if (productRows.length === 0) return byId;
  const ids = productRows.map((row) => row.id);

  const [images, sizes] = await Promise.all([
    db.query(
      `SELECT id, product_id, image_url, is_primary
       FROM product_images WHERE product_id = ANY($1::uuid[])
       ORDER BY is_primary DESC, sort_order ASC, id ASC`,
      [ids],
    ),
    db.query(
      `SELECT id, product_id, size, is_available
       FROM product_size_stocks WHERE product_id = ANY($1::uuid[])
       ORDER BY size ASC`,
      [ids],
    ),
  ]);

  const group = (rows) => {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.product_id)) grouped.set(row.product_id, []);
      grouped.get(row.product_id).push(row);
    }
    return grouped;
  };
  const imagesByProduct = group(images.rows);
  const sizesByProduct = group(sizes.rows);

  for (const row of productRows) {
    byId.set(row.id, toProduct(row, imagesByProduct.get(row.id), sizesByProduct.get(row.id)));
  }
  return byId;
}

/**
 * Traduce los criterios del core a un WHERE parametrizado.
 * Solo se concatenan fragmentos fijos; todos los valores van en `params`.
 */
function buildSearchFilters(criteria) {
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // BR-01: nunca productos ocultos ni de tiendas inactivas.
  const where = ['p.is_hidden = FALSE', 's.is_active = TRUE'];

  if (hasItems(criteria.ids)) {
    where.push(`p.id = ANY(${add(criteria.ids.filter(isUuid))}::uuid[])`);
  }

  const text = criteria.text?.trim();
  if (text) {
    const pattern = add(`%${escapeLike(text)}%`);
    where.push(`(p.name ILIKE ${pattern} OR p.brand ILIKE ${pattern} OR p.subcategory ILIKE ${pattern})`);
  }
  if (criteria.minPrice != null) where.push(`p.price_cop >= ${add(criteria.minPrice)}`);
  if (criteria.maxPrice != null) where.push(`p.price_cop <= ${add(criteria.maxPrice)}`);

  // BR-07: un producto sin el atributo (NULL) nunca coincide con `= ANY(...)`.
  if (hasItems(criteria.brands)) {
    where.push(`LOWER(p.brand) = ANY(${add(criteria.brands.map((b) => String(b).toLowerCase()))}::text[])`);
  }
  if (hasItems(criteria.colors)) where.push(`p.color = ANY(${add(criteria.colors)}::text[])`);
  if (hasItems(criteria.categories)) where.push(`p.category = ANY(${add(criteria.categories)}::text[])`);
  if (hasItems(criteria.subcategories)) where.push(`p.subcategory = ANY(${add(criteria.subcategories)}::text[])`);
  if (hasItems(criteria.sizes)) {
    where.push(`EXISTS (
      SELECT 1 FROM product_size_stocks ps
      WHERE ps.product_id = p.id AND ps.is_available = TRUE AND ps.size = ANY(${add(criteria.sizes)}::text[])
    )`);
  }
  // Se compara como texto para que un id con formato inválido simplemente no coincida.
  if (hasItems(criteria.includeStoreIds)) {
    where.push(`p.store_id::text = ANY(${add(criteria.includeStoreIds.map(String))}::text[])`);
  }
  if (hasItems(criteria.excludeStoreIds)) {
    where.push(`NOT (p.store_id::text = ANY(${add(criteria.excludeStoreIds.map(String))}::text[]))`);
  }

  return { whereSql: where.join(' AND '), params };
}

/** Adapter: `ProductRepository` sobre `products`, `product_images` y `product_size_stocks`. */
export class PgProductRepository extends ProductRepository {
  #db;

  /** @param {{ pool?: import('pg').Pool }} [deps] */
  constructor({ pool } = {}) {
    super();
    this.#db = pool ?? getPool();
  }

  async search(criteria) {
    const page = Math.max(1, Math.trunc(criteria.page) || 1);
    const pageSize = Math.max(1, Math.trunc(criteria.pageSize) || 1);
    const { whereSql, params } = buildSearchFilters(criteria);
    const fromSql = `FROM products p JOIN stores s ON s.id = p.store_id WHERE ${whereSql}`;
    const orderBy = ORDER_BY[criteria.sort] ?? ORDER_BY.default;

    const [countResult, pageResult] = await Promise.all([
      this.#db.query(`SELECT COUNT(*)::int AS total ${fromSql}`, params),
      this.#db.query(
        `SELECT ${PRODUCT_COLUMNS} ${fromSql}
         ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      ),
    ]);

    const byId = await hydrate(this.#db, pageResult.rows);
    const totalItems = countResult.rows[0].total;
    return {
      items: pageResult.rows.map((row) => byId.get(row.id)),
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async findById(id) {
    const byId = await loadProductsByIds(this.#db, [id]);
    return byId.get(id) ?? null;
  }

  /** Respeta el orden de `ids` y omite los inexistentes. */
  async findByIds(ids) {
    const byId = await loadProductsByIds(this.#db, ids);
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  /**
   * Todo el lote en una transacción: o se guarda completo o no se guarda nada.
   * `is_hidden` no se toca, para respetar lo que decidió un administrador.
   */
  async upsertMany(storeId, products) {
    return withTransaction(this.#db, async (client) => {
      let inserted = 0;
      let updated = 0;

      for (const product of products) {
        const { rows } = await client.query(
          `INSERT INTO products (store_id, name, brand, category, subcategory, material, color,
             price_cop, rating, is_second_hand, external_url, last_price_update)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (store_id, external_url) DO UPDATE SET
             name = EXCLUDED.name,
             brand = EXCLUDED.brand,
             category = EXCLUDED.category,
             subcategory = EXCLUDED.subcategory,
             material = EXCLUDED.material,
             color = EXCLUDED.color,
             rating = EXCLUDED.rating,
             is_second_hand = EXCLUDED.is_second_hand,
             last_price_update = CASE
               WHEN products.price_cop IS DISTINCT FROM EXCLUDED.price_cop THEN EXCLUDED.last_price_update
               ELSE products.last_price_update
             END,
             price_cop = EXCLUDED.price_cop
           RETURNING id, (xmax = 0) AS inserted`,
          [
            storeId,
            product.name,
            product.brand,
            product.category,
            product.subcategory,
            product.material,
            product.color,
            product.priceCop,
            product.rating,
            product.isSecondHand,
            product.externalUrl,
            product.lastPriceUpdate,
          ],
        );
        const { id, inserted: isNew } = rows[0];
        product.id = id;
        if (isNew) inserted += 1;
        else updated += 1;

        await replaceImagesAndSizes(client, id, product);
      }

      return { inserted, updated };
    });
  }

  async getFacets() {
    const baseWhere =
      'FROM products p JOIN stores s ON s.id = p.store_id WHERE p.is_hidden = FALSE AND s.is_active = TRUE';
    const [colorsRes, sizesRes, brandsRes, subcategoriesRes, rangeRes] = await Promise.all([
      this.#db.query(
        `SELECT DISTINCT p.color AS value ${baseWhere} AND p.color IS NOT NULL AND TRIM(p.color) <> '' ORDER BY p.color ASC`,
      ),
      this.#db.query(
        `SELECT DISTINCT ps.size AS value
         FROM product_size_stocks ps
         JOIN products p ON p.id = ps.product_id
         JOIN stores s ON s.id = p.store_id
         WHERE p.is_hidden = FALSE AND s.is_active = TRUE AND ps.is_available = TRUE
         ORDER BY ps.size ASC`,
      ),
      this.#db.query(
        `SELECT DISTINCT p.brand AS value ${baseWhere} AND p.brand IS NOT NULL AND TRIM(p.brand) <> '' ORDER BY p.brand ASC`,
      ),
      this.#db.query(
        `SELECT DISTINCT p.subcategory AS value ${baseWhere} AND p.subcategory IS NOT NULL AND TRIM(p.subcategory) <> '' ORDER BY p.subcategory ASC`,
      ),
      this.#db.query(`SELECT MIN(p.price_cop) AS min_price, MAX(p.price_cop) AS max_price ${baseWhere}`),
    ]);
    const rangeRow = rangeRes.rows[0] ?? {};
    const min = toNumberOrNull(rangeRow.min_price);
    const max = toNumberOrNull(rangeRow.max_price);
    return {
      colors: colorsRes.rows.map((r) => r.value),
      sizes: sizesRes.rows.map((r) => r.value),
      brands: brandsRes.rows.map((r) => r.value),
      subcategories: subcategoriesRes.rows.map((r) => r.value),
      priceRange: {
        min: min === null ? null : Math.round(min),
        max: max === null ? null : Math.round(max),
      },
    };
  }
}

/** Reemplaza la galería y las tallas del producto por las recibidas del scraping. */
async function replaceImagesAndSizes(client, productId, product) {
  await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  await client.query('DELETE FROM product_size_stocks WHERE product_id = $1', [productId]);

  if (product.images.length > 0) {
    await client.query(
      `INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
       SELECT $1, img.url, img.is_primary, img.sort_order
       FROM UNNEST($2::text[], $3::boolean[], $4::int[]) AS img(url, is_primary, sort_order)`,
      [
        productId,
        product.images.map((image) => image.imageUrl),
        product.images.map((image) => image.isPrimary),
        product.images.map((_, index) => index),
      ],
    );
  }

  if (product.sizeStocks.length > 0) {
    await client.query(
      `INSERT INTO product_size_stocks (product_id, size, is_available)
       SELECT $1, st.size, st.is_available
       FROM UNNEST($2::text[], $3::boolean[]) AS st(size, is_available)
       ON CONFLICT (product_id, size) DO NOTHING`,
      [
        productId,
        product.sizeStocks.map((stock) => stock.size),
        product.sizeStocks.map((stock) => stock.isAvailable),
      ],
    );
  }
}
