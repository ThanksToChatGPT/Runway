import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogService } from '../core/services/catalogService.js';

test('catalogService normaliza paginación y límite máximo', async () => {
  let capturedFilters = null;
  const catalogService = createCatalogService({
    productRepo: {
      async search(filters) {
        capturedFilters = filters;
        return { items: [], total: 0, page: filters.page, limit: filters.limit };
      },
    },
  });

  await catalogService.searchProducts({ page: '0', limit: '999', sort: 'price_asc' });
  assert.equal(capturedFilters.page, 1);
  assert.equal(capturedFilters.limit, 50);
  assert.equal(capturedFilters.sort, 'price_asc');
});

test('catalogService exige IDs al comparar productos', async () => {
  const catalogService = createCatalogService({ productRepo: {} });
  await assert.rejects(() => catalogService.compareProducts([]), /al menos un ID/);
});
