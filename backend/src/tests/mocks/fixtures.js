/** Constructores de datos de prueba con valores por defecto razonables. */
import { Product } from '../../core/domain/entities/Product.js';
import { Store } from '../../core/domain/entities/Store.js';
import { UserPreference } from '../../core/domain/entities/UserPreference.js';

export const ADMIN = Object.freeze({ userId: 'admin-1', role: 'admin' });
export const REGULAR_USER = Object.freeze({ userId: 'user-1', role: 'user' });

export function buildStore(overrides = {}) {
  return new Store({ name: 'Tienda Bogotá', baseUrl: 'https://tienda.example.co', ...overrides });
}

let productCounter = 0;
export function buildProduct(overrides = {}) {
  productCounter += 1;
  return new Product({
    storeId: 'store-1',
    name: `Prenda ${productCounter}`,
    brand: 'Marca',
    category: 'top',
    color: 'black',
    priceCop: 100000,
    externalUrl: `https://tienda.example.co/p/${productCounter}`,
    images: [{ imageUrl: 'https://cdn.example.co/img.jpg', isPrimary: true }],
    sizeStocks: [{ size: 'M', isAvailable: true }],
    ...overrides,
  });
}

export function buildPreference(userId, values = {}) {
  return new UserPreference({ userId, ...values });
}
