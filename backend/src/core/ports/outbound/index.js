// Puertos salientes: lo que el core necesita del mundo exterior.
// Los adaptadores (PostgreSQL, bcrypt, JWT, HTTP al scraper) los implementan.

// Repository Pattern
export { UserRepository } from './repositories/UserRepository.js';
export { PreferenceRepository } from './repositories/PreferenceRepository.js';
export { StoreRepository } from './repositories/StoreRepository.js';
export { ProductRepository } from './repositories/ProductRepository.js';
export { OutfitRepository } from './repositories/OutfitRepository.js';

// Strategy / Dependency Inversion: seguridad
export { PasswordHasher } from './security/PasswordHasher.js';
export { TokenService } from './security/TokenService.js';

// Strategy / Dependency Inversion: extracción
export { ScraperPort } from './extraction/ScraperPort.js';
