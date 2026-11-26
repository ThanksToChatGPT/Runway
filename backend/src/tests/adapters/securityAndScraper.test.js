import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { assertImplements, PasswordHasher, ScraperPort, TokenService } from '../../core/ports/index.js';
import { UnauthorizedError, ValidationError } from '../../core/domain/index.js';
import {
  BcryptPasswordHasher,
  HttpScraperAdapter,
  JwtTokenService,
  ScraperUnavailableError,
} from '../../adapters/outbound/index.js';

const SECRET = 'test_secret_with_at_least_32_characters!!';

test('los adaptadores de seguridad y scraping cumplen sus puertos', () => {
  assertImplements(new BcryptPasswordHasher(), PasswordHasher);
  assertImplements(new JwtTokenService({ secret: SECRET }), TokenService);
  assertImplements(new HttpScraperAdapter({ baseUrl: 'http://localhost:8000' }), ScraperPort);
});

test('BcryptPasswordHasher usa costo >= 12 y compara sin lanzar errores', async () => {
  assert.throws(() => new BcryptPasswordHasher({ cost: 10 }), /12/);
  const hasher = new BcryptPasswordHasher();
  const hash = await hasher.hash('Secreta123');
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(await hasher.compare('Secreta123', hash), true);
  assert.equal(await hasher.compare('otra', hash), false);
  assert.equal(await hasher.compare('Secreta123', 'no-es-un-hash'), false);
  await assert.rejects(hasher.hash('ñ'.repeat(40)), ValidationError); // 80 bytes > 72
});

test('JwtTokenService firma HS256 de 15 min, verifica y revoca (logout)', async () => {
  const tokens = new JwtTokenService({ secret: SECRET });
  const { token, expiresInSeconds } = await tokens.sign({ sub: 'u1', role: 'user' });
  assert.equal(expiresInSeconds, 900);
  const decoded = jwt.decode(token, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.equal(decoded.payload.exp - decoded.payload.iat, 900);

  assert.deepEqual(await tokens.verify(token), { sub: 'u1', role: 'user' });
  await tokens.revoke(token);
  await tokens.revoke(token); // idempotente
  await assert.rejects(tokens.verify(token), UnauthorizedError);
  await tokens.revoke('basura'); // no lanza
});

test('JwtTokenService rechaza tokens vencidos, alterados o con alg "none"', async () => {
  let now = Date.now();
  const tokens = new JwtTokenService({ secret: SECRET, now: () => now });
  const { token } = await tokens.sign({ sub: 'u1', role: 'admin' });

  const unsigned = jwt.sign({ role: 'admin', sub: 'u1', jti: 'x' }, '', { algorithm: 'none' });
  await assert.rejects(tokens.verify(unsigned), UnauthorizedError);
  const otherKey = jwt.sign({ role: 'admin' }, 'x'.repeat(40), { subject: 'u1', jwtid: 'x', issuer: 'outfit-builder-api' });
  await assert.rejects(tokens.verify(otherKey), UnauthorizedError);

  now += 16 * 60 * 1000;
  await assert.rejects(tokens.verify(token), UnauthorizedError);
});

test('JwtTokenService exige un secreto de al menos 32 caracteres', () => {
  assert.throws(() => new JwtTokenService({ secret: 'corto' }), /32/);
  assert.throws(() => new JwtTokenService({}), /32/);
});

const store = { id: 'store-1', name: 'Tienda Única', baseUrl: 'https://tienda.example' };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('HttpScraperAdapter llama POST /scrape y traduce el formato del servicio Python', async () => {
  let request;
  const scraper = new HttpScraperAdapter({
    baseUrl: 'http://scraper:8000/',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return jsonResponse({
        products: [{
          external_id: 'a1', title: 'Camiseta', brand: 'UrbanCO', category: 'top', color: 'Negro',
          price_cop: 89900, product_url: 'https://tienda.example/a1',
          images: ['https://img.example/1.jpg'],
          sizes: [{ size: 'M', in_stock: true }, { size: 'L', in_stock: false }],
        }],
      });
    },
  });

  const [item] = await scraper.extractProductsByStore(store);

  assert.equal(request.url, 'http://scraper:8000/scrape');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(JSON.parse(request.init.body), { store_id: 'store-1', slug: 'tienda-unica', base_url: 'https://tienda.example' });
  assert.ok(request.init.signal instanceof AbortSignal);
  assert.equal(item.name, 'Camiseta');
  assert.equal(item.externalUrl, 'https://tienda.example/a1');
  assert.equal(item.priceCop, 89900);
  assert.deepEqual(item.imageUrls, ['https://img.example/1.jpg']);
  assert.deepEqual(item.sizes, ['M']);
});

test('HttpScraperAdapter convierte cualquier falla en ScraperUnavailableError', async () => {
  const cases = {
    red: async () => { throw new TypeError('fetch failed'); },
    estado: async () => new Response('Traceback interno…', { status: 500 }),
    json: async () => new Response('<html>', { status: 200 }),
    forma: async () => jsonResponse({ ok: true }),
  };
  for (const [name, fetchImpl] of Object.entries(cases)) {
    const scraper = new HttpScraperAdapter({ baseUrl: 'http://scraper:8000', fetchImpl });
    await assert.rejects(scraper.extractProductsByStore(store), (error) => {
      assert.ok(error instanceof ScraperUnavailableError, name);
      assert.ok(!error.message.includes('Traceback'), 'no expone la respuesta del servicio');
      return true;
    });
  }
});

test('HttpScraperAdapter corta la petición al vencer el timeout', async () => {
  const scraper = new HttpScraperAdapter({
    baseUrl: 'http://scraper:8000',
    timeoutMs: 50,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }),
  });
  const started = Date.now();
  await assert.rejects(scraper.extractProductsByStore(store), /no respondió a tiempo/);
  assert.ok(Date.now() - started < 2000);
});

test('HttpScraperAdapter rechaza una URL de servicio inválida al construirse', () => {
  assert.throws(() => new HttpScraperAdapter({ baseUrl: 'ftp://scraper' }), /http/);
  assert.throws(() => new HttpScraperAdapter({ baseUrl: 'no es url' }), /válida/);
});
