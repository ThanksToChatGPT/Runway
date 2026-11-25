import { notImplemented } from '../contract.js';

/** @typedef {import('./dtos/outfitDtos.js').StartEmptyOutfitInput} StartEmptyOutfitInput */
/** @typedef {import('./dtos/outfitDtos.js').AssignOrReplacePieceInput} AssignOrReplacePieceInput */
/** @typedef {import('./dtos/outfitDtos.js').SaveOutfitInput} SaveOutfitInput */
/** @typedef {import('./dtos/outfitDtos.js').GetOutfitByIdInput} GetOutfitByIdInput */
/** @typedef {import('./dtos/authDtos.js').UserIdInput} UserIdInput */
/** @typedef {import('./dtos/outfitDtos.js').OutfitDto} OutfitDto */

/**
 * Casos de uso del Outfit Builder y "Mis outfits" (US-44 a US-68).
 * Cada respuesta trae el total en COP y el aviso de presupuesto ya calculados
 * con el presupuesto actual del usuario (BR-05, BR-09).
 * Errores esperados: `ValidationError` (prenda en sección incorrecta,
 * outfit vacío), `NotFoundError` (producto u outfit inexistente o ajeno).
 */
export class OutfitBuilderPort {
  /**
   * Borrador con las 3 secciones vacías; no se persiste (FR-24).
   * @param {StartEmptyOutfitInput} input
   * @returns {Promise<OutfitDto>}
   */
  async startEmptyOutfit(input) {
    notImplemented('OutfitBuilderPort', 'startEmptyOutfit');
  }

  /**
   * Pone el producto en la sección indicada (reemplaza la pieza anterior si
   * había) y devuelve el borrador recalculado (FR-25, FR-27).
   * @param {AssignOrReplacePieceInput} input
   * @returns {Promise<OutfitDto>}
   */
  async assignOrReplacePiece(input) {
    notImplemented('OutfitBuilderPort', 'assignOrReplacePiece');
  }

  /**
   * Guarda el outfit con nombre en "Mis outfits" (FR-31). Pasarse del
   * presupuesto no impide guardar.
   * @param {SaveOutfitInput} input
   * @returns {Promise<OutfitDto>}
   */
  async saveOutfit(input) {
    notImplemented('OutfitBuilderPort', 'saveOutfit');
  }

  /**
   * Outfits guardados del usuario, del más reciente al más antiguo.
   * @param {UserIdInput} input
   * @returns {Promise<OutfitDto[]>}
   */
  async getUserOutfits(input) {
    notImplemented('OutfitBuilderPort', 'getUserOutfits');
  }

  /**
   * Un outfit guardado del usuario, con enlaces de compra por pieza (FR-33).
   * Si no existe o es de otra persona: `NotFoundError`.
   * @param {GetOutfitByIdInput} input
   * @returns {Promise<OutfitDto>}
   */
  async getOutfitById(input) {
    notImplemented('OutfitBuilderPort', 'getOutfitById');
  }
}
