import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

/** `/api/admin/stores` (protegido + rol admin) → `AdminStorePort`. */
export function createAdminStoreRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requireAdmin);
  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.put('/:id', asyncHandler(controller.update));
  router.patch('/:id/status', asyncHandler(controller.setStatus));
  router.post('/:id/scrape', asyncHandler(controller.scrape));
  return router;
}
