import express from 'express';
import cors from 'cors';

import { createPool } from './adapters/outbound/db/pool.js';
import { createUserRepository } from './adapters/outbound/db/userRepository.js';
import { createProductRepository } from './adapters/outbound/db/productRepository.js';
import { createOutfitRepository } from './adapters/outbound/db/outfitRepository.js';
import { createStoreRepository } from './adapters/outbound/db/storeRepository.js';
import { createScraperClient } from './adapters/outbound/scraper/scraperClient.js';

import { createAuthService } from './core/services/authService.js';
import { createCatalogService } from './core/services/catalogService.js';
import { createOutfitService } from './core/services/outfitService.js';
import { createAdminService } from './core/services/adminService.js';

import { createAuthMiddleware } from './adapters/inbound/http/authMiddleware.js';
import { createApiRouter } from './adapters/inbound/http/routes.js';
import { errorHandler } from './adapters/inbound/http/errorHandler.js';

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://outfit_user:outfit_pass@localhost:5432/outfit_builder';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Outbound adapters
const pool = createPool(DATABASE_URL);
const userRepo = createUserRepository(pool);
const productRepo = createProductRepository(pool);
const outfitRepo = createOutfitRepository(pool);
const storeRepo = createStoreRepository(pool);
const scraperGateway = createScraperClient({ scraperUrl: SCRAPER_URL });

// Core services
const authService = createAuthService({ userRepo, jwtSecret: JWT_SECRET });
const catalogService = createCatalogService({ productRepo });
const outfitService = createOutfitService({ outfitRepo, productRepo, userRepo });
const adminService = createAdminService({ storeRepo, productRepo, scraperGateway });

// Inbound HTTP adapter
const authMiddleware = createAuthMiddleware(JWT_SECRET);
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(
  '/api',
  createApiRouter({
    authService,
    catalogService,
    outfitService,
    adminService,
    authMiddleware,
    pool,
  })
);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Outfit Builder API running on http://localhost:${PORT}`);
});
