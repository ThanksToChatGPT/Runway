import { CATEGORY_VALUES, RATING_RANGE } from '../constants.js';
import {
  optionalDate,
  optionalText,
  requireCop,
  requireHttpUrl,
  requireId,
  requireOneOf,
  requireText,
} from '../guards.js';
import { ValidationError } from '../errors.js';
import { ProductImage } from './ProductImage.js';
import { ProductSizeStock } from './ProductSizeStock.js';

/**
 * Prenda del catálogo. Se espera que los atributos (categoría, color, tallas)
 * lleguen ya estandarizados por `rules/catalogStandardizer.js`.
 */
export class Product {
  constructor({
    id = null,
    storeId,
    name,
    brand = null,
    category,
    subcategory = null,
    material = null,
    color = null,
    priceCop,
    rating = null,
    isSecondHand = false,
    externalUrl,
    lastPriceUpdate = null,
    isHidden = false,
    images = [],
    sizeStocks = [],
  }) {
    this.id = id;
    this.storeId = requireId(storeId, 'El producto debe pertenecer a una tienda.', 'storeId');
    this.name = requireText(name, 'El nombre del producto es obligatorio.', 'name', { maxLength: 255 });
    this.brand = optionalText(brand);
    this.category = requireOneOf(
      category,
      CATEGORY_VALUES,
      'La categoría del producto no es válida. Usa parte superior, parte inferior o calzado.',
      'category',
    );
    this.subcategory = optionalText(subcategory);
    this.material = optionalText(material);
    this.color = optionalText(color);
    this.priceCop = Product.#validatePrice(priceCop);
    this.rating = Product.#validateRating(rating);
    this.isSecondHand = Boolean(isSecondHand);
    this.externalUrl = requireHttpUrl(
      externalUrl,
      'El producto necesita un enlace válido a la tienda donde se vende.',
      'externalUrl',
    );
    this.lastPriceUpdate = optionalDate(lastPriceUpdate, 'La fecha de actualización del precio no es válida.', 'lastPriceUpdate');
    this.isHidden = Boolean(isHidden);
    this.images = Product.#buildImages(images, id);
    this.sizeStocks = (sizeStocks ?? []).map((s) =>
      s instanceof ProductSizeStock ? s : new ProductSizeStock({ ...s, productId: s.productId ?? id }),
    );
  }

  static #validatePrice(priceCop) {
    return requireCop(priceCop, 'El precio del producto debe ser un valor en pesos igual o mayor a 0.', 'priceCop');
  }

  static #validateRating(rating) {
    if (rating === null || rating === undefined) return null;
    if (typeof rating !== 'number' || rating < RATING_RANGE.MIN || rating > RATING_RANGE.MAX) {
      throw new ValidationError(
        `La calificación debe estar entre ${RATING_RANGE.MIN} y ${RATING_RANGE.MAX}.`,
        { field: 'rating' },
      );
    }
    return rating;
  }

  static #buildImages(images, productId) {
    const list = (images ?? []).map((img) =>
      img instanceof ProductImage ? img : new ProductImage({ ...img, productId: img.productId ?? productId }),
    );
    if (list.filter((img) => img.isPrimary).length > 1) {
      throw new ValidationError('El producto solo puede tener una imagen principal.', { field: 'images' });
    }
    return list;
  }

  updatePrice(newPriceCop, at = new Date()) {
    this.priceCop = Product.#validatePrice(newPriceCop);
    this.lastPriceUpdate = optionalDate(at, 'La fecha de actualización del precio no es válida.', 'lastPriceUpdate');
    return this;
  }

  hide() {
    this.isHidden = true;
    return this;
  }

  show() {
    this.isHidden = false;
    return this;
  }

  /** Imagen principal o, si no hay una marcada, la primera disponible. */
  getPrimaryImage() {
    return this.images.find((img) => img.isPrimary) ?? this.images[0] ?? null;
  }

  getAvailableSizes() {
    return this.sizeStocks.filter((s) => s.isAvailable).map((s) => s.size);
  }

  /** Sin información de tallas se asume disponible (la tienda no la publica). */
  hasStock() {
    return this.sizeStocks.length === 0 || this.sizeStocks.some((s) => s.isAvailable);
  }
}
