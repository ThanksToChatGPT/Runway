import { SLOT_TYPE_VALUES } from '../constants.js';
import { optionalCop, optionalDate, requireId, requireText } from '../guards.js';
import { ValidationError } from '../errors.js';
import { OutfitSlot } from './OutfitSlot.js';

const DEFAULT_NAME = 'Mi outfit';

/**
 * Combinación de prendas (una por sección) con su costo total en COP.
 * Superar el presupuesto es solo una advertencia (`isOverBudget`): nunca bloquea.
 */
export class Outfit {
  /** Último presupuesto evaluado; permite mantener `isOverBudget` al día al cambiar prendas. */
  #maxBudget = null;

  constructor({ id = null, userId, name = DEFAULT_NAME, slots = [], createdAt = new Date() }) {
    this.id = id;
    this.userId = requireId(userId, 'El outfit debe pertenecer a un usuario.', 'userId');
    this.name = Outfit.#validateName(name);
    this.slots = Outfit.#buildSlots(slots, id);
    this.createdAt = optionalDate(createdAt, 'La fecha de creación del outfit no es válida.', 'createdAt') ?? new Date();
    this.totalCostCop = 0;
    this.isOverBudget = false;
    this.calculateTotalPrice();
  }

  /** Crea un outfit nuevo con las tres secciones vacías. */
  static createEmpty(userId, name = DEFAULT_NAME) {
    return new Outfit({ userId, name });
  }

  static #validateName(name) {
    return requireText(name, 'Ponle un nombre a tu outfit.', 'name', { maxLength: 120 });
  }

  // Garantiza exactamente una sección por tipo, en orden fijo (top, bottom, shoes).
  static #buildSlots(slots, outfitId) {
    const byType = new Map();
    for (const raw of slots ?? []) {
      const slot = raw instanceof OutfitSlot ? raw : new OutfitSlot({ ...raw, outfitId: raw.outfitId ?? outfitId });
      if (byType.has(slot.slotType)) {
        throw new ValidationError('El outfit no puede tener dos prendas en la misma sección.', { field: 'slots' });
      }
      byType.set(slot.slotType, slot);
    }
    return SLOT_TYPE_VALUES.map((type) => byType.get(type) ?? new OutfitSlot({ outfitId, slotType: type }));
  }

  getSlot(slotType) {
    OutfitSlot.validateSlotType(slotType);
    return this.slots.find((slot) => slot.slotType === slotType);
  }

  /** Coloca una prenda en la sección indicada, reemplazando la anterior si existía. */
  addOrReplacePiece(slotType, product) {
    this.getSlot(slotType).assign(product);
    this.#refresh();
    return this;
  }

  removePiece(slotType) {
    this.getSlot(slotType).clear();
    this.#refresh();
    return this;
  }

  rename(name) {
    this.name = Outfit.#validateName(name);
    return this;
  }

  isEmpty() {
    return this.slots.every((slot) => slot.isEmpty());
  }

  /** Suma de los precios en COP de las prendas asignadas. */
  calculateTotalPrice() {
    this.totalCostCop = this.slots.reduce((sum, slot) => sum + slot.getPriceCop(), 0);
    return this.totalCostCop;
  }

  /**
   * Compara el total con el presupuesto. Si no hay presupuesto (null), nunca
   * hay advertencia. No lanza error al superarlo: solo marca `isOverBudget`.
   */
  evaluateBudget(maxBudget) {
    this.#maxBudget = optionalCop(
      maxBudget,
      'El presupuesto debe ser un valor en pesos igual o mayor a 0.',
      'maxBudget',
    );
    const total = this.calculateTotalPrice();
    this.isOverBudget = this.#maxBudget !== null && total > this.#maxBudget;

    return {
      totalCostCop: total,
      maxBudget: this.#maxBudget,
      isOverBudget: this.isOverBudget,
      differenceCop: this.#maxBudget === null ? null : Math.abs(this.#maxBudget - total),
    };
  }

  /** Regla para persistir: un outfit guardado debe tener al menos una prenda. */
  ensureCanBeSaved() {
    if (this.isEmpty()) {
      throw new ValidationError('Agrega al menos una prenda antes de guardar tu outfit.', { field: 'slots' });
    }
  }

  #refresh() {
    if (this.#maxBudget !== null) this.evaluateBudget(this.#maxBudget);
    else this.calculateTotalPrice();
  }
}
