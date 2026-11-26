import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';

/** `/api/outfits` (protegido) → `OutfitBuilderPort`. */
export function createOutfitRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate);
  router.post('/draft', asyncHandler(controller.startDraft));
  router.post('/draft/pieces', asyncHandler(controller.assignPiece));
  router.post('/', asyncHandler(controller.save));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.getById));
  return router;
}
