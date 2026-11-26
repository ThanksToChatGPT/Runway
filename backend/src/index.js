/**
 * Composition Root: único lugar donde se instancian los adaptadores concretos
 * y se conectan con el core.
 *
 *   pool PostgreSQL → repositorios → servicios (puertos entrantes) → app HTTP
 */
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

import {
  getPool,
  closePool,
  PgUserRepository,
  PgPreferenceRepository,
  PgStoreRepository,
  PgProductRepository,
  PgOutfitRepository,
  BcryptPasswordHasher,
  JwtTokenService,
  HttpScraperAdapter,
} from './adapters/outbound/index.js';
import {
  AuthAndUserService,
  CatalogSearchService,
  OutfitBuilderService,
  AdminStoreService,
} from './core/services/index.js';
import { createHttpApp } from './adapters/inbound/http/app.js';

const OPENAPI_PATH = new URL('../openapi.yaml', import.meta.url);

function loadOpenApiDocument() {
  try {
    return parseYaml(readFileSync(OPENAPI_PATH, 'utf8'));
  } catch (error) {
    console.warn('[api] No se pudo cargar openapi.yaml; /api/docs no estará disponible:', error.message);
    return undefined;
  }
}

/** `TRUST_PROXY=1` (saltos de proxy), `loopback`, una IP/subred… o sin definir. */
function trustProxyFromEnv(value) {
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return 1;
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

function buildApp() {
  // Adaptadores salientes
  const pool = getPool();
  const userRepository = new PgUserRepository({ pool });
  const preferenceRepository = new PgPreferenceRepository({ pool });
  const storeRepository = new PgStoreRepository({ pool });
  const productRepository = new PgProductRepository({ pool });
  const outfitRepository = new PgOutfitRepository({ pool });
  const passwordHasher = BcryptPasswordHasher.fromEnv();
  const tokenService = JwtTokenService.fromEnv();
  const scraper = HttpScraperAdapter.fromEnv();

  // Core: servicios que implementan los 4 puertos entrantes
  const authService = new AuthAndUserService({ userRepository, preferenceRepository, passwordHasher, tokenService });
  const catalogService = new CatalogSearchService({ productRepository, storeRepository, preferenceRepository });
  const outfitService = new OutfitBuilderService({
    productRepository,
    outfitRepository,
    preferenceRepository,
    storeRepository,
  });
  const adminService = new AdminStoreService({ storeRepository, productRepository, scraper });

  // Adaptador entrante HTTP
  return createHttpApp({
    authService,
    catalogService,
    outfitService,
    adminService,
    checkDatabase: async () => {
      await pool.query('SELECT 1');
    },
    openApiDocument: loadOpenApiDocument(),
    options: {
      corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim()),
      trustProxy: trustProxyFromEnv(process.env.TRUST_PROXY),
    },
  });
}

function main() {
  let app;
  try {
    app = buildApp();
  } catch (error) {
    // Configuración inválida (p. ej. JWT_SECRET corto): no arrancar.
    console.error('[api] No se pudo iniciar el backend:', error.message);
    process.exit(1);
  }

  const port = Number(process.env.PORT) || 4000;
  const server = app.listen(port, () => {
    console.log(`[api] Outfit Builder API en http://localhost:${port}/api (docs: /api/docs)`);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} recibido, cerrando…`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
