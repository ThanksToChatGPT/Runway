import { requireHttpUrl } from '../guards.js';

export class ProductImage {
  constructor({ id = null, productId = null, imageUrl, isPrimary = false }) {
    this.id = id;
    this.productId = productId;
    this.imageUrl = requireHttpUrl(imageUrl, 'La imagen del producto no tiene una dirección válida.', 'imageUrl');
    this.isPrimary = Boolean(isPrimary);
  }
}
