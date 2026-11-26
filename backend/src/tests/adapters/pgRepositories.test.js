import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertImplements,
  OutfitRepository,
  PreferenceRepository,
  ProductRepository,
  StoreRepository,
  UserRepository,
} from '../../core/ports/index.js';
import { ConflictError, Outfit, Product, User, UserPreference } from '../../core/domain/index.js';
import {
  PgOutfitRepository,
  PgPreferenceRepository,
  PgProductRepository,
  PgStoreRepository,
  PgUserRepository,
} from '../../adapters/outbound/index.js';
import { FakePool, IDS, productRow } from './fakePg.js';

test('cada repositorio Pg cumple su puerto', () => {
  const pool = new FakePool();
  assertImplements(new PgUserRepository({ pool }), UserRepository);
  assertImplements(new PgPreferenceRepository({ pool }), PreferenceRepository);
  assertImplements(new PgStoreRepository({ pool }), StoreRepository);
  assertImplements(new PgProductRepository({ pool }), ProductRepository);
  assertImplements(new PgOutfitRepository({ pool }), OutfitRepository);
});

test('PgUserRepository mapea la fila a User y traduce el email duplicado a ConflictError', async () => {
  const row = {
    id: IDS.user, email: 'ana@example.com', password_hash: 'hash', auth_provider: 'local',
    name: 'Ana', country: null, role: 'user',
  };
  const repo = new PgUserRepository({ pool: new FakePool([{ match: /SELECT/, rows: [row] }]) });
  const user = await repo.findByEmail('ana@example.com');
  assert.ok(user instanceof User);
  assert.equal(user.passwordHash, 'hash');

  const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' });
  const failing = new PgUserRepository({ pool: new FakePool([{ match: /INSERT/, error: duplicate }]) });
  await assert.rejects(
    failing.create(new User({ email: 'ana@example.com', passwordHash: 'h', name: 'Ana' })),
    ConflictError,
  );
});

test('un id con formato inválido devuelve null sin consultar la base de datos', async () => {
  const pool = new FakePool();
  assert.equal(await new PgUserRepository({ pool }).findById('1 OR 1=1'), null);
  assert.equal(await new PgStoreRepository({ pool }).findById('abc'), null);
  assert.equal(await new PgOutfitRepository({ pool }).findByIdForUser('x', IDS.user), null);
  assert.deepEqual(await new PgProductRepository({ pool }).findByIds(['nope']), []);
  assert.equal(pool.queries.length, 0);
});

test('PgPreferenceRepository hace upsert por user_id y convierte NUMERIC a Number', async () => {
  const pool = new FakePool([{
    match: /INSERT INTO user_preferences/,
    rows: [{ id: 'p1', user_id: IDS.user, min_price: '10000.00', max_price: null, max_outfit_budget: '300000.00' }],
  }]);
  const saved = await new PgPreferenceRepository({ pool }).upsert(
    new UserPreference({ userId: IDS.user, minPrice: 10000, maxOutfitBudget: 300000 }),
  );
  assert.match(pool.sqlLog()[0], /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.deepEqual(pool.queries[0].params, [IDS.user, 10000, null, 300000]);
  assert.equal(saved.minPrice, 10000);
  assert.equal(saved.maxPrice, null);
  assert.equal(saved.maxOutfitBudget, 300000);
});

test('search arma un WHERE parametrizado: el texto del usuario nunca entra al SQL', async () => {
  const pool = new FakePool([
    { match: /COUNT\(\*\)/, rows: [{ total: 1 }] },
    { match: /FROM products p JOIN stores/, rows: [productRow()] },
    { match: /FROM product_images/, rows: [{ id: 'i1', product_id: IDS.top, image_url: 'https://img.example/1.jpg', is_primary: true }] },
    { match: /FROM product_size_stocks/, rows: [{ id: 's1', product_id: IDS.top, size: 'M', is_available: true }] },
  ]);
  const evil = "'; DROP TABLE users; --";
  const page = await new PgProductRepository({ pool }).search({
    text: `${evil} 50%_off`,
    minPrice: 10000,
    maxPrice: 200000,
    brands: ['UrbanCO'],
    colors: ['black'],
    sizes: ['M'],
    categories: ['top'],
    includeStoreIds: [IDS.store],
    excludeStoreIds: ['otra'],
    sort: 'price_desc',
    page: 2,
    pageSize: 10,
  });

  for (const { sql } of pool.queries) assert.ok(!sql.includes('DROP TABLE'));
  const [countSql, pageSql] = pool.sqlLog();
  assert.match(countSql, /p\.is_hidden = FALSE AND s\.is_active = TRUE/);
  assert.match(pageSql, /ORDER BY p\.price_cop DESC, p\.id ASC LIMIT \$\d+ OFFSET \$\d+/);
  assert.equal(pool.queries[0].params[0], `%${evil} 50\\%\\_off%`);
  assert.deepEqual(pool.queries[1].params.slice(-2), [10, 10]);

  assert.equal(page.totalItems, 1);
  assert.equal(page.totalPages, 1);
  const [product] = page.items;
  assert.ok(product instanceof Product);
  assert.equal(product.priceCop, 89900);
  assert.equal(product.rating, 4.5);
  assert.deepEqual(product.getAvailableSizes(), ['M']);
  assert.equal(product.getPrimaryImage().imageUrl, 'https://img.example/1.jpg');
});

test('search con un sort desconocido usa el orden por defecto (lista blanca)', async () => {
  const pool = new FakePool([{ match: /COUNT/, rows: [{ total: 0 }] }]);
  await new PgProductRepository({ pool }).search({ sort: 'price_asc; DROP', page: 1, pageSize: 20 });
  assert.match(pool.sqlLog()[1], /ORDER BY p\.name ASC, p\.id ASC/);
});

test('findByIds respeta el orden pedido y omite los inexistentes', async () => {
  const pool = new FakePool([
    { match: /FROM products p WHERE/, rows: [productRow(), productRow({ id: IDS.shoes, category: 'shoes', external_url: 'https://tienda.example/tenis' })] },
  ]);
  const products = await new PgProductRepository({ pool }).findByIds([IDS.shoes, IDS.outfit, IDS.top]);
  assert.deepEqual(products.map((p) => p.id), [IDS.shoes, IDS.top]);
});

test('upsertMany guarda en una transacción y cuenta insertados/actualizados', async () => {
  let call = 0;
  const pool = new FakePool([
    { match: /INSERT INTO products/, rows: () => [{ id: call++ === 0 ? IDS.top : IDS.shoes, inserted: call === 1 }] },
  ]);
  const product = (url, category) => new Product({
    storeId: IDS.store, name: 'Prenda', category, priceCop: 50000, externalUrl: url,
    images: [{ imageUrl: 'https://img.example/a.jpg', isPrimary: true }],
    sizeStocks: [{ size: 'M' }],
  });
  const items = [product('https://t.example/a', 'top'), product('https://t.example/b', 'shoes')];

  const result = await new PgProductRepository({ pool }).upsertMany(IDS.store, items);

  assert.deepEqual(result, { inserted: 1, updated: 1 });
  assert.equal(items[0].id, IDS.top);
  const log = pool.sqlLog();
  assert.equal(log[0], 'BEGIN');
  assert.equal(log.at(-1), 'COMMIT');
  assert.ok(log.some((sql) => sql.startsWith('INSERT INTO product_images')));
  assert.equal(pool.released, 1);
});

test('upsertMany hace ROLLBACK y libera la conexión si algo falla', async () => {
  const pool = new FakePool([{ match: /INSERT INTO products/, error: new Error('boom') }]);
  const item = new Product({ storeId: IDS.store, name: 'X', category: 'top', priceCop: 1, externalUrl: 'https://t.example/x' });
  await assert.rejects(new PgProductRepository({ pool }).upsertMany(IDS.store, [item]), /boom/);
  assert.equal(pool.sqlLog().at(-1), 'ROLLBACK');
  assert.equal(pool.released, 1);
});

test('PgOutfitRepository.create inserta outfit + 3 secciones en una transacción', async () => {
  const pool = new FakePool([
    { match: /INSERT INTO outfits/, rows: [{ id: IDS.outfit, user_id: IDS.user, name: 'Lunes', total_cost_cop: '89900.00', is_over_budget: true, created_at: new Date() }] },
    { match: /INSERT INTO outfit_slots/, rows: (params) => params[1].map((slotType, i) => ({ id: `slot-${i}`, outfit_id: IDS.outfit, slot_type: slotType, product_id: params[2][i] })) },
  ]);
  const top = new Product({ id: IDS.top, storeId: IDS.store, name: 'Top', category: 'top', priceCop: 89900, externalUrl: 'https://t.example/top' });
  const outfit = Outfit.createEmpty(IDS.user, 'Lunes').addOrReplacePiece('top', top);
  outfit.evaluateBudget(50000);

  const saved = await new PgOutfitRepository({ pool }).create(outfit);

  const log = pool.sqlLog();
  assert.deepEqual([log[0], log.at(-1)], ['BEGIN', 'COMMIT']);
  const slotsInsert = pool.queries.find((q) => q.sql.includes('outfit_slots'));
  assert.deepEqual(slotsInsert.params[1], ['top', 'bottom', 'shoes']);
  assert.deepEqual(slotsInsert.params[2], [IDS.top, null, null]);
  assert.equal(saved.id, IDS.outfit);
  assert.equal(saved.getSlot('top').product, top);
  assert.equal(saved.totalCostCop, 89900);
  assert.equal(saved.isOverBudget, true);
});

test('findByIdForUser filtra por dueño y rehidrata aunque la prenda esté oculta', async () => {
  const pool = new FakePool([
    { match: /FROM outfits WHERE id = \$1 AND user_id = \$2/, rows: [{ id: IDS.outfit, user_id: IDS.user, name: 'Viernes', total_cost_cop: '89900.00', is_over_budget: false, created_at: new Date() }] },
    { match: /FROM outfit_slots/, rows: [
      { id: 's1', outfit_id: IDS.outfit, slot_type: 'top', product_id: IDS.top },
      { id: 's2', outfit_id: IDS.outfit, slot_type: 'bottom', product_id: null },
      { id: 's3', outfit_id: IDS.outfit, slot_type: 'shoes', product_id: null },
    ] },
    { match: /FROM products p WHERE/, rows: [productRow({ is_hidden: true })] },
  ]);

  const outfit = await new PgOutfitRepository({ pool }).findByIdForUser(IDS.outfit, IDS.user);

  assert.deepEqual(pool.queries[0].params, [IDS.outfit, IDS.user]);
  assert.ok(outfit instanceof Outfit);
  assert.equal(outfit.getSlot('top').product.isHidden, true);
  assert.equal(outfit.getSlot('bottom').product, null);
  assert.equal(outfit.totalCostCop, 89900);
});

test('PgProductRepository.getFacets consulta colores, tallas, marcas, subcategorías y rango COP', async () => {
  const pool = new FakePool([
    { match: /DISTINCT p\.color/, rows: [{ value: 'black' }, { value: 'white' }] },
    { match: /DISTINCT ps\.size/, rows: [{ value: 'M' }, { value: '40' }] },
    { match: /DISTINCT p\.brand/, rows: [{ value: 'Koaj' }] },
    { match: /DISTINCT p\.subcategory/, rows: [{ value: 'camiseta' }] },
    { match: /MIN\(p\.price_cop\)/, rows: [{ min_price: '39900.00', max_price: '229900.00' }] },
  ]);
  const facets = await new PgProductRepository({ pool }).getFacets();
  assert.deepEqual(facets, {
    colors: ['black', 'white'],
    sizes: ['M', '40'],
    brands: ['Koaj'],
    subcategories: ['camiseta'],
    priceRange: { min: 39900, max: 229900 },
  });
});
