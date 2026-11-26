import { OutfitRepository } from '../../../core/ports/index.js';
import { getPool } from './pool.js';
import { toOutfit } from './mappers.js';
import { isUuid, withTransaction } from './sqlHelpers.js';
import { loadProductsByIds } from './PgProductRepository.js';

const OUTFIT_COLUMNS = 'id, user_id, name, total_cost_cop, is_over_budget, created_at';

/** Adapter: `OutfitRepository` sobre `outfits` + `outfit_slots`. */
export class PgOutfitRepository extends OutfitRepository {
  #db;

  /** @param {{ pool?: import('pg').Pool }} [deps] */
  constructor({ pool } = {}) {
    super();
    this.#db = pool ?? getPool();
  }

  /** Inserta el outfit y sus 3 secciones en una sola transacción. */
  async create(outfit) {
    const { outfitRow, slotRows } = await withTransaction(this.#db, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO outfits (user_id, name, total_cost_cop, is_over_budget)
         VALUES ($1, $2, $3, $4)
         RETURNING ${OUTFIT_COLUMNS}`,
        [outfit.userId, outfit.name, outfit.totalCostCop, outfit.isOverBudget],
      );
      const created = rows[0];

      const slots = await client.query(
        `INSERT INTO outfit_slots (outfit_id, slot_type, product_id)
         SELECT $1, sl.slot_type, sl.product_id
         FROM UNNEST($2::text[], $3::uuid[]) AS sl(slot_type, product_id)
         RETURNING id, outfit_id, slot_type, product_id`,
        [
          created.id,
          outfit.slots.map((slot) => slot.slotType),
          outfit.slots.map((slot) => slot.product?.id ?? null),
        ],
      );
      return { outfitRow: created, slotRows: slots.rows };
    });

    // Las prendas ya están cargadas en memoria: no hace falta volver a leerlas.
    const productsById = new Map(
      outfit.slots.filter((slot) => slot.product).map((slot) => [slot.product.id, slot.product]),
    );
    return toOutfit(outfitRow, slotRows, productsById);
  }

  async findByUserId(userId) {
    if (!isUuid(userId)) return [];
    const { rows } = await this.#db.query(
      `SELECT ${OUTFIT_COLUMNS} FROM outfits
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [userId],
    );
    return this.#hydrate(rows);
  }

  /** BR-16: filtra por id Y dueño; un outfit ajeno se comporta como inexistente. */
  async findByIdForUser(outfitId, userId) {
    if (!isUuid(outfitId) || !isUuid(userId)) return null;
    const { rows } = await this.#db.query(
      `SELECT ${OUTFIT_COLUMNS} FROM outfits WHERE id = $1 AND user_id = $2`,
      [outfitId, userId],
    );
    const [outfit] = await this.#hydrate(rows);
    return outfit ?? null;
  }

  /** Carga secciones y prendas de varios outfits con un número fijo de consultas. */
  async #hydrate(outfitRows) {
    if (outfitRows.length === 0) return [];

    const { rows: slotRows } = await this.#db.query(
      `SELECT id, outfit_id, slot_type, product_id
       FROM outfit_slots WHERE outfit_id = ANY($1::uuid[])`,
      [outfitRows.map((row) => row.id)],
    );
    const productIds = slotRows.map((slot) => slot.product_id).filter(Boolean);
    const productsById = await loadProductsByIds(this.#db, productIds);

    return outfitRows.map((row) =>
      toOutfit(
        row,
        slotRows.filter((slot) => slot.outfit_id === row.id),
        productsById,
      ),
    );
  }
}
