import { AppError } from '../domain/errors.js';

export function createAdminService({ storeRepo, productRepo, scraperGateway }) {
  return {
    async listStores() {
      return storeRepo.findAll();
    },

    async createStore(input) {
      const name = String(input?.name || '').trim();
      const slug = String(input?.slug || '').trim().toLowerCase();
      const base_url = String(input?.base_url || '').trim();
      const is_active = input?.is_active !== undefined ? Boolean(input.is_active) : true;

      if (!name || !slug || !base_url) {
        throw new AppError('name, slug y base_url son obligatorios', 400);
      }

      return storeRepo.create({ name, slug, base_url, is_active });
    },

    async updateStore(id, input) {
      const updated = await storeRepo.update(id, input);
      if (!updated) {
        throw new AppError('Tienda no encontrada', 404);
      }
      return updated;
    },

    async deleteStore(id) {
      const removed = await storeRepo.remove(id);
      if (!removed) {
        throw new AppError('Tienda no encontrada', 404);
      }
    },

    async triggerScrape(storeId) {
      const store = await storeRepo.findById(storeId);
      if (!store) {
        throw new AppError('Tienda no encontrada', 404);
      }
      if (!store.is_active) {
        throw new AppError('La tienda está inactiva', 400);
      }

      const normalizedProducts = await scraperGateway.scrapeStore(store);
      const importedCount = await productRepo.upsertScrapedProducts(store.id, normalizedProducts);

      return {
        storeId: store.id,
        storeSlug: store.slug,
        importedCount,
      };
    },
  };
}
