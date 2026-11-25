/**
 * DTOs del Outfit Builder (OutfitBuilderPort).
 *
 * El outfit en construcción vive en el frontend como un "borrador" sin estado
 * en el servidor: el cliente envía los ids de las piezas y el core devuelve el
 * outfit recalculado (total COP + aviso de presupuesto). Solo se persiste al
 * llamar `saveOutfit`.
 */

import { SLOT_LABELS } from '../../../domain/constants.js';
import { toStoreRefDto } from './catalogDtos.js';

/** @typedef {import('../../../domain/entities/Outfit.js').Outfit} Outfit */
/** @typedef {import('../../../domain/entities/Store.js').Store} Store */
/** @typedef {import('./catalogDtos.js').StoreRefDto} StoreRefDto */

// ------------------------------------------------------------------ Entradas

/**
 * Id de producto por sección; ausente o null = sección vacía.
 * @typedef {Object} OutfitPiecesInput
 * @property {string|null} [top]
 * @property {string|null} [bottom]
 * @property {string|null} [shoes]
 */

/**
 * @typedef {Object} StartEmptyOutfitInput
 * @property {string} userId
 * @property {string} [name]
 */

/**
 * Agrega o reemplaza una pieza sobre el borrador actual (FR-24, FR-25, FR-27).
 * @typedef {Object} AssignOrReplacePieceInput
 * @property {string} userId
 * @property {{ name?: string, pieces?: OutfitPiecesInput }} draft estado actual del builder.
 * @property {'top'|'bottom'|'shoes'} slotType
 * @property {string} productId
 */

/**
 * @typedef {Object} SaveOutfitInput
 * @property {string} userId
 * @property {string} name nombre definido por el usuario (FR-31).
 * @property {OutfitPiecesInput} pieces al menos una pieza.
 */

/**
 * @typedef {Object} GetOutfitByIdInput
 * @property {string} userId
 * @property {string} outfitId
 */

// ------------------------------------------------------------------- Salidas

/**
 * Pieza dentro del outfit: muestra tienda y precio (US-55) y el enlace
 * de compra (FR-33).
 * @typedef {Object} OutfitPieceDto
 * @property {string} productId
 * @property {string} name
 * @property {string|null} brand
 * @property {number} priceCop
 * @property {string|null} primaryImageUrl
 * @property {string} externalUrl
 * @property {StoreRefDto} store
 */

/**
 * @typedef {Object} OutfitSlotDto
 * @property {'top'|'bottom'|'shoes'} slotType
 * @property {string} label nombre legible en español.
 * @property {OutfitPieceDto|null} piece
 */

/**
 * Aviso de presupuesto: nunca bloquea (BR-05).
 * @typedef {Object} BudgetStatusDto
 * @property {number|null} maxBudget       null si el usuario no definió presupuesto.
 * @property {boolean} isOverBudget
 * @property {number|null} differenceCop   cuánto falta o sobra frente al presupuesto.
 */

/**
 * @typedef {Object} OutfitDto
 * @property {string|null} id          null mientras es un borrador.
 * @property {boolean} isSaved
 * @property {string} name
 * @property {OutfitSlotDto[]} slots   siempre 3, en orden top, bottom, shoes.
 * @property {number} totalCostCop
 * @property {'COP'} currency
 * @property {BudgetStatusDto} budget
 * @property {string|null} createdAt   ISO 8601; null en borradores.
 */

// ------------------------------------------------------------------ Mappers

/**
 * @param {Outfit} outfit
 * @param {Object} [context]
 * @param {BudgetStatusDto} [context.budget] resultado de `outfit.evaluateBudget(...)`.
 * @param {Map<string, Store>} [context.storesById]
 * @returns {OutfitDto}
 */
export function toOutfitDto(outfit, { budget, storesById } = {}) {
  const isSaved = outfit.id !== null && outfit.id !== undefined;
  return {
    id: isSaved ? outfit.id : null,
    isSaved,
    name: outfit.name,
    slots: outfit.slots.map((slot) => ({
      slotType: slot.slotType,
      label: SLOT_LABELS[slot.slotType],
      piece: slot.product
        ? {
            productId: slot.product.id,
            name: slot.product.name,
            brand: slot.product.brand,
            priceCop: slot.product.priceCop,
            primaryImageUrl: slot.product.getPrimaryImage()?.imageUrl ?? null,
            externalUrl: slot.product.externalUrl,
            store: toStoreRefDto(slot.product.storeId, storesById),
          }
        : null,
    })),
    totalCostCop: outfit.totalCostCop,
    currency: 'COP',
    budget: {
      maxBudget: budget?.maxBudget ?? null,
      isOverBudget: budget?.isOverBudget ?? outfit.isOverBudget,
      differenceCop: budget?.differenceCop ?? null,
    },
    createdAt: isSaved ? outfit.createdAt.toISOString() : null,
  };
}
