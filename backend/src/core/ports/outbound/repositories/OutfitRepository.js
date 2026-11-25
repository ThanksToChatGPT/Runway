import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/Outfit.js').Outfit} Outfit */

/**
 * Repositorio del agregado `Outfit` (tablas `outfits` y `outfit_slots`).
 * Devuelve outfits completos: cada `OutfitSlot` con su `Product` cargado
 * (o vacío si el producto fue eliminado, `ON DELETE SET NULL`).
 */
export class OutfitRepository {
  /**
   * Guarda un outfit nuevo con sus 3 secciones, en una transacción.
   * Persiste `totalCostCop` e `isOverBudget` tal como los calculó el dominio.
   * @param {Outfit} outfit
   * @returns {Promise<Outfit>} outfit persistido, con id y `createdAt`.
   */
  async create(outfit) {
    notImplemented('OutfitRepository', 'create');
  }

  /**
   * Outfits del usuario, del más reciente al más antiguo ("Mis outfits").
   * @param {string} userId
   * @returns {Promise<Outfit[]>}
   */
  async findByUserId(userId) {
    notImplemented('OutfitRepository', 'findByUserId');
  }

  /**
   * Busca un outfit validando la propiedad (BR-16): filtra por id Y userId.
   * Si existe pero es de otra persona devuelve null, para no revelar que existe.
   * @param {string} outfitId
   * @param {string} userId
   * @returns {Promise<Outfit|null>}
   */
  async findByIdForUser(outfitId, userId) {
    notImplemented('OutfitRepository', 'findByIdForUser');
  }
}
