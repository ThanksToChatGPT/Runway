import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';

/** `/api/products` (público) → `CatalogSearchPort`. */
export function createCatalogRoutes({ controller, optionalAuthenticate, publicLimiter }) {
  const router = Router();
  router.use(publicLimiter);
  router.get('/', optionalAuthenticate, asyncHandler(controller.search));
  // `/compare` va antes de `/:id` para que "compare" no se lea como un id.
  router.get('/compare', asyncHandler(controller.compare));
  router.get('/:id', asyncHandler(controller.getById));
  return router;
}
