import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ports from '../../core/ports/index.js';
import { assertImplements, getPortMethods } from '../../core/ports/contract.js';

const PORT_METHODS = {
  // Salientes
  UserRepository: ['findByEmail', 'findById', 'create'],
  PreferenceRepository: ['findByUserId', 'upsert'],
  StoreRepository: ['findAll', 'findById', 'create', 'update', 'setActive'],
  ProductRepository: ['search', 'findById', 'findByIds', 'upsertMany', 'getFacets'],
  OutfitRepository: ['create', 'findByUserId', 'findByIdForUser'],
  PasswordHasher: ['hash', 'compare'],
  TokenService: ['sign', 'verify', 'revoke'],
  ScraperPort: ['extractProductsByStore'],
  // Entrantes
  AuthAndUserPort: ['register', 'login', 'logout', 'verifySession', 'getPreferencesSummary', 'updatePreferences'],
  CatalogSearchPort: ['searchProducts', 'getProductDetail', 'compareProducts', 'listActiveStores', 'getCatalogFacets'],
  OutfitBuilderPort: ['startEmptyOutfit', 'assignOrReplacePiece', 'saveOutfit', 'getUserOutfits', 'getOutfitById'],
  AdminStorePort: ['createStore', 'updateStore', 'toggleStoreStatus', 'listStores', 'runStoreScraping'],
};

test('cada puerto expone exactamente los métodos del contrato', () => {
  for (const [name, methods] of Object.entries(PORT_METHODS)) {
    assert.equal(typeof ports[name], 'function', `falta exportar ${name}`);
    assert.deepEqual(getPortMethods(ports[name]).sort(), [...methods].sort(), name);
  }
});

test('los métodos base rechazan con "no implementado"', async () => {
  for (const [name, methods] of Object.entries(PORT_METHODS)) {
    const instance = new ports[name]();
    for (const method of methods) {
      await assert.rejects(instance[method](), new RegExp(`${name}\\.${method}\\(\\) no está implementado`));
    }
  }
});

test('assertImplements acepta una clase que extiende el puerto', () => {
  class InMemoryHasher extends ports.PasswordHasher {
    async hash(plain) { return `hashed:${plain}`; }
    async compare(plain, hash) { return hash === `hashed:${plain}`; }
  }
  const hasher = new InMemoryHasher();
  assert.equal(assertImplements(hasher, ports.PasswordHasher), hasher);
});

test('assertImplements acepta un objeto plano (duck typing)', () => {
  const scraper = { async extractProductsByStore() { return []; } };
  assert.doesNotThrow(() => assertImplements(scraper, ports.ScraperPort));
});

test('assertImplements lista los métodos que faltan o no se sobrescribieron', () => {
  class Partial extends ports.TokenService {
    async sign() { return { token: 't', expiresInSeconds: 900 }; }
  }
  assert.throws(
    () => assertImplements(new Partial(), ports.TokenService),
    /TokenService no define: verify, revoke/,
  );
  assert.throws(() => assertImplements(null, ports.ScraperPort), /extractProductsByStore/);
});

test('core/ports no importa infraestructura ni nada fuera de core/', () => {
  const portsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../core/ports');
  const coreDir = resolve(portsDir, '..');
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.js')) files.push(full);
    }
  };
  walk(portsDir);
  assert.ok(files.length >= 20, 'se esperaban los archivos de puertos');

  const importRegex = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(importRegex)) {
      const specifier = match[1] ?? match[2];
      assert.ok(specifier.startsWith('.'), `${file} importa un paquete externo: ${specifier}`);
      const target = resolve(dirname(file), specifier);
      assert.ok(target.startsWith(coreDir + sep), `${file} importa fuera de core/: ${specifier}`);
    }
  }
});
