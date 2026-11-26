import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { createAuthMiddleware, createOptionalAuthMiddleware } from './middlewares/authMiddleware.js';
import { createLoginRateLimiter, createPublicRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createAuthController } from './controllers/authController.js';
import { createCatalogController } from './controllers/catalogController.js';
import { createOutfitController } from './controllers/outfitController.js';
import { createAdminStoreController } from './controllers/adminStoreController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createCatalogRoutes } from './routes/catalogRoutes.js';
import { createOutfitRoutes } from './routes/outfitRoutes.js';
import { createAdminStoreRoutes } from './routes/adminStoreRoutes.js';

/**
 * Adaptador entrante HTTP: arma la aplicación Express a partir de los 4
 * puertos entrantes. No instancia adaptadores ni servicios: los recibe ya
 * construidos desde el Composition Root (`src/index.js`).
 *
 * @param {Object} deps
 * @param {import('../../../core/ports/inbound/AuthAndUserPort.js').AuthAndUserPort} deps.authService
 * @param {import('../../../core/ports/inbound/CatalogSearchPort.js').CatalogSearchPort} deps.catalogService
 * @param {import('../../../core/ports/inbound/OutfitBuilderPort.js').OutfitBuilderPort} deps.outfitService
 * @param {import('../../../core/ports/inbound/AdminStorePort.js').AdminStorePort} deps.adminService
 * @param {() => Promise<void>} [deps.checkDatabase] ping a la base de datos para el healthcheck.
 * @param {object} [deps.openApiDocument] especificación OpenAPI ya parseada (para `/api/docs`).
 * @param {Object} [deps.options]
 * @param {string|string[]} [deps.options.corsOrigin]
 * @param {string|boolean|number} [deps.options.trustProxy]
 * @param {{ public?: object, login?: object }} [deps.options.rateLimit] opciones de los limitadores.
 * @returns {import('express').Express}
 */
export function createHttpApp({
  authService,
  catalogService,
  outfitService,
  adminService,
  checkDatabase = async () => {},
  openApiDocument,
  options = {},
}) {
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy !== undefined) app.set('trust proxy', options.trustProxy);

  // Documentación interactiva. Va antes del helmet global porque Swagger UI
  // usa estilos inline: aquí la CSP se desactiva solo para estas rutas.
  if (openApiDocument) {
    app.get('/api/docs/openapi.json', (_req, res) => res.json(openApiDocument));
    app.use(
      '/api/docs',
      helmet({ contentSecurityPolicy: false }),
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, { customSiteTitle: 'Outfit Builder API' }),
    );
  }

  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin ?? 'http://localhost:3000' }));
  app.use(express.json({ limit: '100kb' }));

  // Eslabones compartidos de la cadena.
  const authenticate = createAuthMiddleware(authService);
  const optionalAuthenticate = createOptionalAuthMiddleware(authService);
  const publicLimiter = createPublicRateLimiter(options.rateLimit?.public);
  const loginLimiter = createLoginRateLimiter(options.rateLimit?.login);

  app.get('/api/health', async (_req, res) => {
    try {
      await checkDatabase();
      res.status(200).json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  const { auth, preferences } = createAuthRoutes({
    controller: createAuthController(authService),
    authenticate,
    publicLimiter,
    loginLimiter,
  });
  app.use('/api/auth', auth);
  app.use('/api/preferences', preferences);
  app.use(
    '/api/products',
    createCatalogRoutes({ controller: createCatalogController(catalogService), optionalAuthenticate, publicLimiter }),
  );
  app.use('/api/outfits', createOutfitRoutes({ controller: createOutfitController(outfitService), authenticate }));
  app.use(
    '/api/admin/stores',
    createAdminStoreRoutes({ controller: createAdminStoreController(adminService), authenticate }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
