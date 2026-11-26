import { StoreRepository } from '../../../core/ports/index.js';
import { getPool } from './pool.js';
import { toStore } from './mappers.js';
import { isUuid } from './sqlHelpers.js';

const COLUMNS = 'id, name, base_url, is_active, last_scraped_at';

/** Adapter: `StoreRepository` sobre la tabla `stores`. */
export class PgStoreRepository extends StoreRepository {
  #db;

  /** @param {{ pool?: import('pg').Pool }} [deps] */
  constructor({ pool } = {}) {
    super();
    this.#db = pool ?? getPool();
  }

  async findAll({ onlyActive = false } = {}) {
    const { rows } = await this.#db.query(
      `SELECT ${COLUMNS} FROM stores
       WHERE ($1::boolean = FALSE OR is_active = TRUE)
       ORDER BY name ASC, id ASC`,
      [Boolean(onlyActive)],
    );
    return rows.map(toStore);
  }

  async findById(id) {
    if (!isUuid(id)) return null;
    const { rows } = await this.#db.query(`SELECT ${COLUMNS} FROM stores WHERE id = $1`, [id]);
    return toStore(rows[0]);
  }

  async create(store) {
    const { rows } = await this.#db.query(
      `INSERT INTO stores (name, base_url, is_active, last_scraped_at)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [store.name, store.baseUrl, store.isActive, store.lastScrapedAt],
    );
    return toStore(rows[0]);
  }

  async update(store) {
    if (!isUuid(store.id)) return null;
    const { rows } = await this.#db.query(
      `UPDATE stores SET name = $2, base_url = $3, last_scraped_at = $4
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [store.id, store.name, store.baseUrl, store.lastScrapedAt],
    );
    return toStore(rows[0]);
  }

  async setActive(id, isActive) {
    if (!isUuid(id)) return null;
    const { rows } = await this.#db.query(
      `UPDATE stores SET is_active = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, Boolean(isActive)],
    );
    return toStore(rows[0]);
  }
}
