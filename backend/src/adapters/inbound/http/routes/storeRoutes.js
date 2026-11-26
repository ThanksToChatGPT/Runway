import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';

/** `/api/stores` (público) → `CatalogSearchPort.listActiveStores`. */
export function createStoreRoutes({ controller, publicLimiter }) {
  const router = Router();
  router.use(publicLimiter);
  router.get('/', asyncHandler(controller.listStores));
  return router;
}
