import { PreferenceRepository } from '../../../core/ports/index.js';
import { getPool } from './pool.js';
import { toUserPreference } from './mappers.js';
import { isUuid } from './sqlHelpers.js';

const COLUMNS = 'id, user_id, min_price, max_price, max_outfit_budget';

/** Adapter: `PreferenceRepository` sobre `user_preferences` (una fila por usuario). */
export class PgPreferenceRepository extends PreferenceRepository {
  #db;

  /** @param {{ pool?: import('pg').Pool }} [deps] */
  constructor({ pool } = {}) {
    super();
    this.#db = pool ?? getPool();
  }

  async findByUserId(userId) {
    if (!isUuid(userId)) return null;
    const { rows } = await this.#db.query(
      `SELECT ${COLUMNS} FROM user_preferences WHERE user_id = $1`,
      [userId],
    );
    return toUserPreference(rows[0]);
  }

  /** Inserta o actualiza en una sola sentencia atómica (`ON CONFLICT (user_id)`). */
  async upsert(preference) {
    const { rows } = await this.#db.query(
      `INSERT INTO user_preferences (user_id, min_price, max_price, max_outfit_budget)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         min_price = EXCLUDED.min_price,
         max_price = EXCLUDED.max_price,
         max_outfit_budget = EXCLUDED.max_outfit_budget,
         updated_at = NOW()
       RETURNING ${COLUMNS}`,
      [preference.userId, preference.minPrice, preference.maxPrice, preference.maxOutfitBudget],
    );
    return toUserPreference(rows[0]);
  }
}
