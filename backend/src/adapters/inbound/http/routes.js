import { Router } from 'express';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApiRouter({
  authService,
  catalogService,
  outfitService,
  adminService,
  authMiddleware,
  pool,
}) {
  const router = Router();
  const { requireAuth, requireAdmin } = authMiddleware;

  // Healthcheck
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'connected' });
    })
  );

  // Auth
  router.post(
    '/auth/register',
    asyncHandler(async (req, res) => {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    })
  );

  router.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const result = await authService.login(req.body);
      res.json(result);
    })
  );

  // Preferences
  router.get(
    '/preferences',
    requireAuth,
    asyncHandler(async (req, res) => {
      const prefs = await authService.getPreferences(req.user.id);
      res.json(prefs);
    })
  );

  router.put(
    '/preferences',
    requireAuth,
    asyncHandler(async (req, res) => {
      const prefs = await authService.updatePreferences(req.user.id, req.body);
      res.json(prefs);
    })
  );

  // Public Stores list (for catalog filter)
  router.get(
    '/stores',
    asyncHandler(async (_req, res) => {
      const stores = await adminService.listStores();
      res.json(stores.filter((s) => s.is_active));
    })
  );

  // Catalog
  router.get(
    '/products',
    asyncHandler(async (req, res) => {
      const result = await catalogService.searchProducts(req.query);
      res.json(result);
    })
  );

  router.get(
    '/products/compare',
    asyncHandler(async (req, res) => {
      const ids = String(req.query.ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const products = await catalogService.compareProducts(ids);
      res.json({ items: products });
    })
  );

  router.get(
    '/products/:id',
    asyncHandler(async (req, res) => {
      const product = await catalogService.getProductById(req.params.id);
      res.json(product);
    })
  );

  // Outfits
  router.get(
    '/outfits',
    requireAuth,
    asyncHandler(async (req, res) => {
      const outfits = await outfitService.listUserOutfits(req.user.id);
      res.json({ items: outfits });
    })
  );

  router.post(
    '/outfits',
    requireAuth,
    asyncHandler(async (req, res) => {
      const outfit = await outfitService.saveOutfit(req.user.id, req.body);
      res.status(201).json(outfit);
    })
  );

  router.delete(
    '/outfits/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      await outfitService.deleteOutfit(req.user.id, req.params.id);
      res.status(204).send();
    })
  );

  // Admin
  router.get(
    '/admin/stores',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const stores = await adminService.listStores();
      res.json({ items: stores });
    })
  );

  router.post(
    '/admin/stores',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const store = await adminService.createStore(req.body);
      res.status(201).json(store);
    })
  );

  router.put(
    '/admin/stores/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const store = await adminService.updateStore(req.params.id, req.body);
      res.json(store);
    })
  );

  router.delete(
    '/admin/stores/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await adminService.deleteStore(req.params.id);
      res.status(204).send();
    })
  );

  router.post(
    '/admin/stores/:id/scrape',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const summary = await adminService.triggerScrape(req.params.id);
      res.json(summary);
    })
  );

  return router;
}
