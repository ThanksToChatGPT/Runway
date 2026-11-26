import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { createHttpApp } from '../../adapters/inbound/http/app.js';
import { createRateLimiter } from '../../adapters/inbound/http/middlewares/rateLimiter.js';
import {
  AdminStoreService,
  AuthAndUserService,
  CatalogSearchService,
  OutfitBuilderService,
} from '../../core/services/index.js';
import {
  FakePasswordHasher,
  FakeScraper,
  FakeTokenService,
  InMemoryOutfitRepository,
  InMemoryPreferenceRepository,
  InMemoryProductRepository,
  InMemoryStoreRepository,
  InMemoryUserRepository,
  buildProduct,
  buildStore,
} from '../mocks/index.js';

// App real con el core real y adaptadores salientes en memoria.
const tokenService = new FakeTokenService();
const userRepository = new InMemoryUserRepository();
const preferenceRepository = new InMemoryPreferenceRepository();
const storeRepository = new InMemoryStoreRepository();
const productRepository = new InMemoryProductRepository();
const outfitRepository = new InMemoryOutfitRepository();

let store;
let top;
let shoes;
let server;
let baseUrl;

before(async () => {
  store = await storeRepository.create(buildStore());
  [top, shoes] = productRepository.seed(
    buildProduct({ storeId: store.id, category: 'top', priceCop: 100000 }),
    buildProduct({ storeId: store.id, category: 'shoes', priceCop: 250000 }),
  );

  const app = createHttpApp({
    authService: new AuthAndUserService({
      userRepository,
      preferenceRepository,
      passwordHasher: new FakePasswordHasher(),
      tokenService,
    }),
    catalogService: new CatalogSearchService({ productRepository, storeRepository, preferenceRepository }),
    outfitService: new OutfitBuilderService({ productRepository, outfitRepository, preferenceRepository, storeRepository }),
    adminService: new AdminStoreService({ storeRepository, productRepository, scraper: new FakeScraper({ error: new Error('caído') }) }),
    openApiDocument: { openapi: '3.0.3', info: { title: 'test', version: '1' }, paths: {} },
    options: { rateLimit: { login: { max: 3 } } },
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

async function call(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function registerUser(email = 'laura@example.com') {
  const res = await call('POST', '/auth/register', { body: { email, password: 'Secreta123', name: 'Laura' } });
  return res.body.accessToken;
}

test('GET /health responde ok', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', database: 'ok' });
});

test('GET /docs sirve Swagger UI', async () => {
  const res = await fetch(`${baseUrl}/docs/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /swagger/i);
});

test('registro → 201 con sesión; correo repetido → 409 en español', async () => {
  const first = await call('POST', '/auth/register', {
    body: { email: 'ana@example.com', password: 'Secreta123', name: 'Ana' },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.tokenType, 'Bearer');
  assert.equal(first.body.user.email, 'ana@example.com');
  assert.equal(first.body.user.passwordHash, undefined);

  const again = await call('POST', '/auth/register', {
    body: { email: 'ana@example.com', password: 'Secreta123', name: 'Ana' },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.field, 'email');
  assert.match(again.body.error, /correo/);
});

test('contraseña débil → 400; JSON malformado → 400 sin detalles técnicos', async () => {
  const weak = await call('POST', '/auth/register', { body: { email: 'x@example.com', password: '123', name: 'X' } });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.field, 'password');

  const broken = await call('POST', '/auth/register', { body: '{"email":' });
  assert.equal(broken.status, 400);
  assert.deepEqual(broken.body, { error: 'El cuerpo de la petición no es un JSON válido.' });
});

test('rutas protegidas: sin token → 401; logout revoca el token', async () => {
  assert.equal((await call('GET', '/preferences')).status, 401);
  assert.equal((await call('GET', '/preferences', { token: 'falso' })).status, 401);

  const token = await registerUser('logout@example.com');
  assert.equal((await call('GET', '/preferences', { token })).status, 200);
  assert.equal((await call('POST', '/auth/logout', { token })).status, 204);
  assert.equal((await call('GET', '/preferences', { token })).status, 401);
});

test('preferencias: PUT actualiza y valida rango', async () => {
  const token = await registerUser('prefs@example.com');
  const ok = await call('PUT', '/preferences', { token, body: { maxOutfitBudget: 300000 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.maxOutfitBudget, 300000);
  assert.equal(ok.body.hasBudget, true);

  const bad = await call('PUT', '/preferences', { token, body: { minPrice: 500, maxPrice: 100 } });
  assert.equal(bad.status, 400);
});

test('catálogo: búsqueda con filtros, detalle, comparación y 404', async () => {
  const search = await call('GET', '/products?category=top,shoes&sort=price_desc&maxPrice=300000');
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.items.map((p) => p.id), [shoes.id, top.id]);
  assert.equal(search.body.items[0].store.name, store.name);

  assert.equal((await call('GET', '/products?minPrice=abc')).status, 400);
  assert.equal((await call('GET', '/products?category=hats')).status, 400);

  const detail = await call('GET', `/products/${top.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.externalUrl, top.externalUrl);

  const compare = await call('GET', `/products/compare?ids=${top.id},${shoes.id}`);
  assert.equal(compare.status, 200);
  assert.equal(compare.body.products.length, 2);
  assert.equal((await call('GET', `/products/compare?ids=${top.id}`)).status, 400);

  const missing = await call('GET', '/products/no-existe');
  assert.equal(missing.status, 404);
  assert.match(missing.body.error, /producto/);

  const storesRes = await call('GET', '/stores');
  assert.equal(storesRes.status, 200);
  assert.deepEqual(storesRes.body, { items: [{ id: store.id, name: store.name }] });

  const facetsRes = await call('GET', '/products/facets');
  assert.equal(facetsRes.status, 200);
  assert.deepEqual(facetsRes.body.priceRange, { min: 100000, max: 250000 });
});

test('outfit builder: borrador → piezas → guardar → listar → detalle', async () => {
  const token = await registerUser('outfits@example.com');
  await call('PUT', '/preferences', { token, body: { maxOutfitBudget: 200000 } });

  const draft = await call('POST', '/outfits/draft', { token, body: { name: 'Oficina' } });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.slots.length, 3);
  assert.equal(draft.body.isSaved, false);

  const withTop = await call('POST', '/outfits/draft/pieces', {
    token,
    body: { draft: { name: 'Oficina' }, slotType: 'top', productId: top.id },
  });
  assert.equal(withTop.status, 200);
  const withShoes = await call('POST', '/outfits/draft/pieces', {
    token,
    body: { draft: { name: 'Oficina', pieces: { top: top.id } }, slotType: 'shoes', productId: shoes.id },
  });
  assert.equal(withShoes.body.totalCostCop, 350000);
  assert.equal(withShoes.body.budget.isOverBudget, true);

  const wrongSlot = await call('POST', '/outfits/draft/pieces', {
    token,
    body: { slotType: 'bottom', productId: top.id },
  });
  assert.equal(wrongSlot.status, 400);

  const saved = await call('POST', '/outfits', { token, body: { name: 'Oficina', pieces: { top: top.id, shoes: shoes.id } } });
  assert.equal(saved.status, 201);
  assert.equal(saved.headers.get('location'), `/api/outfits/${saved.body.id}`);

  const list = await call('GET', '/outfits', { token });
  assert.equal(list.body.items.length, 1);

  const detail = await call('GET', `/outfits/${saved.body.id}`, { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.slots[0].piece.externalUrl, top.externalUrl);

  // Un outfit ajeno se comporta como inexistente.
  const other = await registerUser('otra@example.com');
  assert.equal((await call('GET', `/outfits/${saved.body.id}`, { token: other })).status, 404);
});

test('admin: usuario normal → 403; admin gestiona tiendas y scraping fallido no rompe', async () => {
  const userToken = await registerUser('normal@example.com');
  const forbidden = await call('GET', '/admin/stores', { token: userToken });
  assert.equal(forbidden.status, 403);
  assert.match(forbidden.body.error, /administradores/);

  const { token: adminToken } = await tokenService.sign({ sub: 'admin-1', role: 'admin' });
  const created = await call('POST', '/admin/stores', {
    token: adminToken,
    body: { name: 'Tienda Medellín', baseUrl: 'https://medellin.example.co' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.isActive, true);

  const updated = await call('PUT', `/admin/stores/${created.body.id}`, { token: adminToken, body: { name: 'Tienda MDE' } });
  assert.equal(updated.body.name, 'Tienda MDE');

  const badStatus = await call('PATCH', `/admin/stores/${created.body.id}/status`, { token: adminToken, body: {} });
  assert.equal(badStatus.status, 400);

  const scrape = await call('POST', `/admin/stores/${created.body.id}/scrape`, { token: adminToken });
  assert.equal(scrape.status, 200);
  assert.equal(scrape.body.status, 'failed');

  const off = await call('PATCH', `/admin/stores/${created.body.id}/status`, { token: adminToken, body: { isActive: false } });
  assert.equal(off.body.isActive, false);
  assert.equal((await call('POST', `/admin/stores/${created.body.id}/scrape`, { token: adminToken })).status, 400);

  const list = await call('GET', '/admin/stores', { token: adminToken });
  assert.equal(list.body.items.length, 2);
  assert.equal((await call('PUT', '/admin/stores/no-existe', { token: adminToken, body: { name: 'X' } })).status, 404);
});

test('login: credenciales erróneas → 401 genérico y bloqueo por fuerza bruta → 429', async () => {
  await registerUser('bruta@example.com');
  const ok = await call('POST', '/auth/login', { body: { email: 'bruta@example.com', password: 'Secreta123' } });
  assert.equal(ok.status, 200);

  for (let i = 0; i < 3; i += 1) {
    const fail = await call('POST', '/auth/login', { body: { email: 'bruta@example.com', password: 'mala' } });
    assert.equal(fail.status, 401);
    assert.equal(fail.body.error, 'El correo o la contraseña no son correctos.');
  }
  const blocked = await call('POST', '/auth/login', { body: { email: 'bruta@example.com', password: 'Secreta123' } });
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
});

test('ruta inexistente → 404 en español; headers de seguridad presentes', async () => {
  const res = await call('GET', '/no-existe');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'La ruta solicitada no existe.' });
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('rateLimiter: corta con 429 al superar el máximo y se reinicia con la ventana', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => now });
  const run = () => {
    const res = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, on() {} };
    let passed = false;
    limiter({ ip: '1.1.1.1' }, res, () => { passed = true; });
    return { passed, res };
  };
  assert.equal(run().passed, true);
  assert.equal(run().passed, true);
  const third = run();
  assert.equal(third.passed, false);
  assert.equal(third.res.statusCode, 429);
  now = 1001;
  assert.equal(run().passed, true);
});
