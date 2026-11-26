import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';

/** `/api/products` (público) → `CatalogSearchPort`. */
export function createCatalogRoutes({ controller, optionalAuthenticate, publicLimiter }) {
  const router = Router();
  router.use(publicLimiter);
  router.get('/', optionalAuthenticate, asyncHandler(controller.search));
  // `/facets` y `/compare` van antes de `/:id` para no confundirse con un id.
  router.get('/facets', asyncHandler(controller.facets));
  router.get('/compare', asyncHandler(controller.compare));
  router.get('/:id', asyncHandler(controller.getById));
  return router;
}
