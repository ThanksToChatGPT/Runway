import test from 'node:test';
import assert from 'node:assert/strict';

import { AdminStoreService } from '../../core/services/index.js';
import { AdminStorePort, assertImplements } from '../../core/ports/index.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../core/domain/errors.js';
import {
  ADMIN,
  FakeScraper,
  InMemoryProductRepository,
  InMemoryStoreRepository,
  REGULAR_USER,
  buildStore,
} from '../mocks/index.js';

const NOW = new Date('2026-11-25T12:00:00Z');

async function setup({ scraper = new FakeScraper(), storeActive = true } = {}) {
  const storeRepository = new InMemoryStoreRepository();
  const productRepository = new InMemoryProductRepository();
  const store = await storeRepository.create(buildStore({ isActive: storeActive }));
  const service = new AdminStoreService({ storeRepository, productRepository, scraper, now: () => NOW });
  return { service, storeRepository, productRepository, scraper, store };
}

const RAW_ITEMS = [
  {
    name: 'Camiseta básica',
    category: 'Camisetas',
    color: 'Negro',
    sizes: ['Mediana', 'talla s', 'M'],
    priceCop: 59900,
    externalUrl: 'https://tienda.example.co/camiseta',
    imageUrls: ['https://cdn.example.co/1.jpg', 'no-es-url', 'https://cdn.example.co/2.jpg'],
    brand: 'Local',
  },
  {
    name: 'Jean slim',
    category: 'Pantalones',
    color: 'Azul oscuro',
    sizes: ['32', 'EU 34'],
    priceCop: 149900,
    externalUrl: 'https://tienda.example.co/jean',
  },
  // Descartados: contenido restringido, fuera de categorías MVP y precio inválido.
  { name: 'Vibrador recargable', category: 'Juguetes', priceCop: 80000, externalUrl: 'https://tienda.example.co/x' },
  { name: 'Gorra plana', category: 'Accesorios', priceCop: 40000, externalUrl: 'https://tienda.example.co/gorra' },
  { name: 'Tenis running', category: 'Tenis', priceCop: -5, externalUrl: 'https://tienda.example.co/tenis' },
];

test('implementa todos los métodos de AdminStorePort', async () => {
  const { service } = await setup();
  assert.doesNotThrow(() => assertImplements(service, AdminStorePort));
});

test('solo un admin puede usar cualquier operación de tiendas', async () => {
  const { service, store, scraper } = await setup();
  const calls = [
    (actor) => service.listStores({ actor }),
    (actor) => service.createStore({ actor, name: 'Nueva', baseUrl: 'https://nueva.co' }),
    (actor) => service.updateStore({ actor, storeId: store.id, name: 'Otro' }),
    (actor) => service.toggleStoreStatus({ actor, storeId: store.id, isActive: false }),
    (actor) => service.runStoreScraping({ actor, storeId: store.id }),
  ];
  for (const call of calls) {
    await assert.rejects(call(REGULAR_USER), ForbiddenError);
    await assert.rejects(call(undefined), UnauthorizedError);
  }
  assert.equal(scraper.calls.length, 0);
  assert.equal(store.name, 'Tienda Bogotá');
  assert.equal(store.isActive, true);
});

test('createStore, updateStore, toggleStoreStatus y listStores devuelven StoreDto', async () => {
  const { service, store } = await setup();

  const created = await service.createStore({ actor: ADMIN, name: 'Arturo Calle', baseUrl: 'https://arturocalle.com' });
  assert.deepEqual(created, {
    id: 'store-2',
    name: 'Arturo Calle',
    baseUrl: 'https://arturocalle.com',
    isActive: true,
    lastScrapedAt: null,
  });

  const updated = await service.updateStore({ actor: ADMIN, storeId: store.id, name: 'Tienda Medellín' });
  assert.equal(updated.name, 'Tienda Medellín');
  assert.equal(updated.baseUrl, 'https://tienda.example.co');

  const toggled = await service.toggleStoreStatus({ actor: ADMIN, storeId: store.id, isActive: false });
  assert.equal(toggled.isActive, false);

  const list = await service.listStores({ actor: ADMIN });
  assert.deepEqual(list.map((s) => [s.name, s.isActive]), [['Arturo Calle', true], ['Tienda Medellín', false]]);
});

test('validaciones de tiendas: datos inválidos, estado no booleano y tienda inexistente', async () => {
  const { service, store } = await setup();
  await assert.rejects(service.createStore({ actor: ADMIN, name: '', baseUrl: 'https://x.co' }), ValidationError);
  await assert.rejects(service.createStore({ actor: ADMIN, name: 'X', baseUrl: 'ftp://x.co' }), ValidationError);
  await assert.rejects(service.updateStore({ actor: ADMIN, storeId: store.id, baseUrl: 'mala' }), ValidationError);
  await assert.rejects(service.toggleStoreStatus({ actor: ADMIN, storeId: store.id, isActive: 'no' }), ValidationError);
  await assert.rejects(service.updateStore({ actor: ADMIN, storeId: 'store-99', name: 'X' }), NotFoundError);
  await assert.rejects(service.toggleStoreStatus({ actor: ADMIN, storeId: 'store-99', isActive: true }), NotFoundError);
  await assert.rejects(service.runStoreScraping({ actor: ADMIN }), ValidationError);
});

test('runStoreScraping estandariza, filtra contenido restringido y guarda en lote', async () => {
  const { service, productRepository, store, scraper } = await setup({ scraper: new FakeScraper({ items: RAW_ITEMS }) });

  const result = await service.runStoreScraping({ actor: ADMIN, storeId: store.id });

  assert.deepEqual(result, {
    storeId: store.id,
    status: 'success',
    receivedCount: 5,
    discardedCount: 3,
    insertedCount: 2,
    updatedCount: 0,
    finishedAt: NOW.toISOString(),
    message: 'Catálogo actualizado: 2 nuevos, 0 actualizados y 3 descartados.',
  });
  assert.deepEqual(scraper.calls, [store.id]);

  const [shirt, jeans] = productRepository.all();
  assert.equal(shirt.category, 'top');
  assert.equal(shirt.color, 'black');
  assert.deepEqual(shirt.getAvailableSizes(), ['M', 'S']);
  assert.deepEqual(shirt.images.map((i) => [i.imageUrl, i.isPrimary]), [
    ['https://cdn.example.co/1.jpg', true],
    ['https://cdn.example.co/2.jpg', false],
  ]);
  assert.equal(shirt.storeId, store.id);
  assert.equal(jeans.category, 'bottom');
  assert.equal(jeans.color, 'navy');
  assert.deepEqual(jeans.getAvailableSizes(), ['32', '34']);
  assert.ok(!productRepository.all().some((p) => /vibrador/i.test(p.name)));
  assert.equal(store.lastScrapedAt.toISOString(), NOW.toISOString());
});

test('una segunda extracción actualiza los productos existentes en vez de duplicarlos', async () => {
  const { service, productRepository, store } = await setup({ scraper: new FakeScraper({ items: RAW_ITEMS }) });
  await service.runStoreScraping({ actor: ADMIN, storeId: store.id });
  const second = await service.runStoreScraping({ actor: ADMIN, storeId: store.id });

  assert.equal(second.insertedCount, 0);
  assert.equal(second.updatedCount, 2);
  assert.equal(productRepository.all().length, 2);
});

test('runStoreScraping rechaza tiendas inactivas o inexistentes sin llamar al scraper', async () => {
  const { service, store, scraper } = await setup({ storeActive: false });
  await assert.rejects(
    service.runStoreScraping({ actor: ADMIN, storeId: store.id }),
    (error) => error instanceof ValidationError && /inactiva/.test(error.message),
  );
  await assert.rejects(service.runStoreScraping({ actor: ADMIN, storeId: 'store-99' }), NotFoundError);
  assert.equal(scraper.calls.length, 0);
});

test('si el scraper falla devuelve status failed y no toca el catálogo (RNF-13)', async () => {
  const scraper = new FakeScraper({ error: new Error('timeout') });
  const { service, productRepository, store } = await setup({ scraper });

  const result = await service.runStoreScraping({ actor: ADMIN, storeId: store.id });

  assert.equal(result.status, 'failed');
  assert.equal(result.insertedCount, 0);
  assert.match(result.message, /No pudimos obtener los productos/);
  assert.equal(productRepository.all().length, 0);
  assert.equal(store.lastScrapedAt, null);
});

test('una respuesta del scraper sin productos válidos termina bien sin escribir en el catálogo', async () => {
  const scraper = new FakeScraper({ items: [RAW_ITEMS[2], RAW_ITEMS[3]] });
  const { service, productRepository, store } = await setup({ scraper });
  const result = await service.runStoreScraping({ actor: ADMIN, storeId: store.id });
  assert.equal(result.status, 'success');
  assert.equal(result.discardedCount, 2);
  assert.equal(productRepository.all().length, 0);
});
