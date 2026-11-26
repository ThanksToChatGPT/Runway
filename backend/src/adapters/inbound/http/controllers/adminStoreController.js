/**
 * Adapter (driving): HTTP ↔ `AdminStorePort`.
 * El `actor` (id + rol) sale del token; el core vuelve a exigir rol admin.
 *
 * @param {import('../../../../core/ports/inbound/AdminStorePort.js').AdminStorePort} adminService
 */
export function createAdminStoreController(adminService) {
  const actorOf = (req) => ({ userId: req.user.id, role: req.user.role });

  return {
    async list(req, res) {
      const items = await adminService.listStores({ actor: actorOf(req) });
      res.status(200).json({ items });
    },

    async create(req, res) {
      const { name, baseUrl, isActive } = req.body ?? {};
      const store = await adminService.createStore({ actor: actorOf(req), name, baseUrl, isActive });
      res.status(201).location(`/api/admin/stores/${store.id}`).json(store);
    },

    async update(req, res) {
      const { name, baseUrl } = req.body ?? {};
      const store = await adminService.updateStore({ actor: actorOf(req), storeId: req.params.id, name, baseUrl });
      res.status(200).json(store);
    },

    async setStatus(req, res) {
      const { isActive } = req.body ?? {};
      const store = await adminService.toggleStoreStatus({ actor: actorOf(req), storeId: req.params.id, isActive });
      res.status(200).json(store);
    },

    async scrape(req, res) {
      // Si el scraper falla, el core no lanza: responde `status: 'failed'` (RNF-13).
      const result = await adminService.runStoreScraping({ actor: actorOf(req), storeId: req.params.id });
      res.status(200).json(result);
    },
  };
}
