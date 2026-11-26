// Adaptadores salientes (Fase 4): implementan los puertos de core/ports/outbound.

// PostgreSQL (Repository + Data Mapper sobre un pool Singleton)
export { getPool, closePool } from './db/pool.js';
export { PgUserRepository } from './db/PgUserRepository.js';
export { PgPreferenceRepository } from './db/PgPreferenceRepository.js';
export { PgStoreRepository } from './db/PgStoreRepository.js';
export { PgProductRepository } from './db/PgProductRepository.js';
export { PgOutfitRepository } from './db/PgOutfitRepository.js';

// Seguridad
export { BcryptPasswordHasher } from './security/BcryptPasswordHasher.js';
export { JwtTokenService } from './security/JwtTokenService.js';

// Extracción
export { HttpScraperAdapter, ScraperUnavailableError } from './scraper/HttpScraperAdapter.js';
