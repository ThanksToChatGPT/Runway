import { SLOT_LABELS, SLOT_TYPE_VALUES } from '../constants.js';
import { requireOneOf } from '../guards.js';
import { ValidationError } from '../errors.js';
import { Product } from './Product.js';

export class OutfitSlot {
  constructor({ id = null, outfitId = null, slotType, product = null }) {
    this.id = id;
    this.outfitId = outfitId;
    this.slotType = OutfitSlot.validateSlotType(slotType);
    this.product = null;
    if (product) this.assign(product);
  }

  static validateSlotType(slotType) {
    return requireOneOf(
      slotType,
      SLOT_TYPE_VALUES,
      'Esa sección del outfit no existe. Usa parte superior, parte inferior o calzado.',
      'slotType',
    );
  }

  /** Asigna una prenda verificando que corresponda a esta sección y esté disponible. */
  assign(product) {
    if (!(product instanceof Product)) {
      throw new ValidationError('Selecciona una prenda válida del catálogo.', { field: 'product' });
    }
    if (product.category !== this.slotType) {
      throw new ValidationError(
        `Esta prenda no se puede usar como ${SLOT_LABELS[this.slotType]}.`,
        { field: 'product' },
      );
    }
    if (product.isHidden) {
      throw new ValidationError('Esta prenda ya no está disponible en el catálogo.', { field: 'product' });
    }
    this.product = product;
    return this;
  }

  clear() {
    this.product = null;
    return this;
  }

  isEmpty() {
    return this.product === null;
  }

  getPriceCop() {
    return this.product?.priceCop ?? 0;
  }
}
