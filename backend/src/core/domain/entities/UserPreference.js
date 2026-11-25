import { optionalCop, requireId } from '../guards.js';
import { ValidationError } from '../errors.js';

/**
 * Preferencias de compra del usuario. Todos los montos son en COP.
 * Cualquier monto puede quedar vacío (null) si el usuario no lo define.
 */
export class UserPreference {
  constructor({ id = null, userId, minPrice = null, maxPrice = null, maxOutfitBudget = null }) {
    this.id = id;
    this.userId = requireId(userId, 'Las preferencias deben pertenecer a un usuario.', 'userId');
    this.#apply({ minPrice, maxPrice, maxOutfitBudget });
  }

  static createDefault(userId) {
    return new UserPreference({ userId });
  }

  /** Actualiza solo los campos enviados y vuelve a validar el conjunto. */
  update(changes = {}) {
    this.#apply({
      minPrice: 'minPrice' in changes ? changes.minPrice : this.minPrice,
      maxPrice: 'maxPrice' in changes ? changes.maxPrice : this.maxPrice,
      maxOutfitBudget: 'maxOutfitBudget' in changes ? changes.maxOutfitBudget : this.maxOutfitBudget,
    });
    return this;
  }

  hasBudget() {
    return this.maxOutfitBudget !== null;
  }

  isPriceInRange(priceCop) {
    if (this.minPrice !== null && priceCop < this.minPrice) return false;
    if (this.maxPrice !== null && priceCop > this.maxPrice) return false;
    return true;
  }

  getSummary() {
    return {
      userId: this.userId,
      priceRange: { min: this.minPrice, max: this.maxPrice },
      maxOutfitBudget: this.maxOutfitBudget,
      hasPriceRange: this.minPrice !== null || this.maxPrice !== null,
      hasBudget: this.hasBudget(),
      currency: 'COP',
    };
  }

  // Valida todo antes de asignar, para nunca quedar en un estado parcial.
  #apply({ minPrice, maxPrice, maxOutfitBudget }) {
    const min = optionalCop(minPrice, 'El precio mínimo debe ser un valor en pesos igual o mayor a 0.', 'minPrice');
    const max = optionalCop(maxPrice, 'El precio máximo debe ser un valor en pesos igual o mayor a 0.', 'maxPrice');
    const budget = optionalCop(
      maxOutfitBudget,
      'El presupuesto por outfit debe ser un valor en pesos igual o mayor a 0.',
      'maxOutfitBudget',
    );

    if (min !== null && max !== null && min > max) {
      throw new ValidationError('El precio mínimo no puede ser mayor que el precio máximo.', { field: 'minPrice' });
    }

    this.minPrice = min;
    this.maxPrice = max;
    this.maxOutfitBudget = budget;
  }
}
