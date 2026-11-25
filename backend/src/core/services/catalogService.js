import { AppError } from '../domain/errors.js';

export function createCatalogService({ productRepo }) {
  return {
    async searchProducts(query) {
      const page = Math.max(1, Number(query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(query.limit || 12)));

      return productRepo.search({
        q: query.q ? String(query.q).trim() : undefined,
        category: query.category || undefined,
        brand: query.brand ? String(query.brand).trim() : undefined,
        color: query.color ? String(query.color).trim() : undefined,
        size: query.size ? String(query.size).trim() : undefined,
        storeId: query.storeId || undefined,
        minPrice: query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : undefined,
        sort: ['price_asc', 'price_desc', 'newest'].includes(query.sort) ? query.sort : 'newest',
        page,
        limit,
      });
    },

    async getProductById(id) {
      const product = await productRepo.findById(id);
      if (!product) {
        throw new AppError('Producto no encontrado', 404);
      }
      return product;
    },

    async compareProducts(ids) {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Debes enviar al menos un ID de producto para comparar', 400);
      }
      const uniqueIds = [...new Set(ids)].slice(0, 4);
      return productRepo.findByIds(uniqueIds);
    },
  };
}
