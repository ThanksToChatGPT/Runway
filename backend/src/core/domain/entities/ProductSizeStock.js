import { requireText } from '../guards.js';

export class ProductSizeStock {
  constructor({ id = null, productId = null, size, isAvailable = true }) {
    this.id = id;
    this.productId = productId;
    this.size = requireText(size, 'Cada talla del producto debe tener un nombre.', 'size', { maxLength: 20 });
    this.isAvailable = Boolean(isAvailable);
  }

  markAvailable() {
    this.isAvailable = true;
    return this;
  }

  markUnavailable() {
    this.isAvailable = false;
    return this;
  }
}
