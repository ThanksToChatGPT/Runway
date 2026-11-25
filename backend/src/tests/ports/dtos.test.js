import test from 'node:test';
import assert from 'node:assert/strict';

import { Outfit, Product, Store, User, UserPreference } from '../../core/domain/index.js';
import {
  toAuthSessionDto,
  toOutfitDto,
  toPreferencesSummaryDto,
  toProductDetailDto,
  toProductPageDto,
  toStoreDto,
} from '../../core/ports/index.js';

const store = new Store({ id: 's1', name: 'Tienda Uno', baseUrl: 'https://tienda.co' });
const storesById = new Map([[store.id, store]]);

const product = (id, category, priceCop) =>
  new Product({
    id,
    storeId: 's1',
    name: `Prenda ${id}`,
    brand: 'Marca',
    category,
    priceCop,
    externalUrl: `https://tienda.co/p/${id}`,
    images: [
      { imageUrl: `https://tienda.co/img/${id}-2.jpg` },
      { imageUrl: `https://tienda.co/img/${id}-1.jpg`, isPrimary: true },
    ],
    sizeStocks: [
      { size: 'S', isAvailable: false },
      { size: 'M', isAvailable: true },
    ],
  });

test('toAuthSessionDto nunca expone el hash de la contraseña', () => {
  const user = new User({ id: 'u1', email: 'Ana@Correo.co', passwordHash: 'secreto', name: 'Ana' });
  const dto = toAuthSessionDto({ token: 'jwt', expiresInSeconds: 900 }, user);

  assert.deepEqual(dto, {
    accessToken: 'jwt',
    tokenType: 'Bearer',
    expiresInSeconds: 900,
    user: { id: 'u1', email: 'ana@correo.co', name: 'Ana', country: null, role: 'user' },
  });
  assert.ok(!JSON.stringify(dto).includes('secreto'));
});

test('toPreferencesSummaryDto devuelve el resumen en COP', () => {
  const pref = new UserPreference({ userId: 'u1', minPrice: 10000, maxPrice: 90000, maxOutfitBudget: 200000 });
  assert.deepEqual(toPreferencesSummaryDto(pref), {
    userId: 'u1',
    priceRange: { min: 10000, max: 90000 },
    maxOutfitBudget: 200000,
    hasPriceRange: true,
    hasBudget: true,
    currency: 'COP',
  });
});

test('toProductDetailDto incluye galería, tallas, tienda y enlace externo', () => {
  const dto = toProductDetailDto(product('p1', 'top', 50000), storesById);

  assert.equal(dto.store.name, 'Tienda Uno');
  assert.equal(dto.currency, 'COP');
  assert.equal(dto.externalUrl, 'https://tienda.co/p/p1');
  assert.deepEqual(dto.sizes, [
    { size: 'S', isAvailable: false },
    { size: 'M', isAvailable: true },
  ]);
  assert.equal(dto.images.length, 2);
  assert.equal(dto.lastPriceUpdate, null);
});

test('toProductPageDto usa la imagen principal y solo tallas disponibles en la tarjeta', () => {
  const page = { items: [product('p1', 'top', 50000)], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
  const dto = toProductPageDto(page, storesById);

  assert.equal(dto.items[0].primaryImageUrl, 'https://tienda.co/img/p1-1.jpg');
  assert.deepEqual(dto.items[0].availableSizes, ['M']);
  assert.deepEqual(dto.items[0].store, { id: 's1', name: 'Tienda Uno' });
  assert.equal(dto.totalItems, 1);
});

test('toProductPageDto tolera tiendas desconocidas (nombre null)', () => {
  const page = { items: [product('p1', 'top', 50000)], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
  assert.deepEqual(toProductPageDto(page).items[0].store, { id: 's1', name: null });
});

test('toOutfitDto de un borrador: 3 secciones, total y aviso de presupuesto', () => {
  const outfit = Outfit.createEmpty('u1')
    .addOrReplacePiece('top', product('p1', 'top', 80000))
    .addOrReplacePiece('shoes', product('p3', 'shoes', 150000));
  const budget = outfit.evaluateBudget(200000);

  const dto = toOutfitDto(outfit, { budget, storesById });

  assert.equal(dto.id, null);
  assert.equal(dto.isSaved, false);
  assert.equal(dto.createdAt, null);
  assert.deepEqual(dto.slots.map((s) => s.slotType), ['top', 'bottom', 'shoes']);
  assert.equal(dto.slots[0].label, 'parte superior');
  assert.equal(dto.slots[1].piece, null);
  assert.equal(dto.slots[2].piece.store.name, 'Tienda Uno');
  assert.equal(dto.slots[2].piece.externalUrl, 'https://tienda.co/p/p3');
  assert.equal(dto.totalCostCop, 230000);
  assert.deepEqual(dto.budget, { maxBudget: 200000, isOverBudget: true, differenceCop: 30000 });
});

test('toOutfitDto de un outfit guardado sin evaluar presupuesto', () => {
  const createdAt = new Date('2026-11-25T10:00:00Z');
  const outfit = new Outfit({ id: 'o1', userId: 'u1', name: 'Domingo', createdAt });
  const dto = toOutfitDto(outfit);

  assert.equal(dto.isSaved, true);
  assert.equal(dto.createdAt, '2026-11-25T10:00:00.000Z');
  assert.deepEqual(dto.budget, { maxBudget: null, isOverBudget: false, differenceCop: null });
});

test('toStoreDto serializa fechas en ISO', () => {
  const s = new Store({ id: 's2', name: 'Otra', baseUrl: 'https://otra.co', isActive: false, lastScrapedAt: '2026-11-01T00:00:00Z' });
  assert.deepEqual(toStoreDto(s), {
    id: 's2',
    name: 'Otra',
    baseUrl: 'https://otra.co',
    isActive: false,
    lastScrapedAt: '2026-11-01T00:00:00.000Z',
  });
});
