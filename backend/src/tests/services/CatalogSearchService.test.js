import test from 'node:test';
import assert from 'node:assert/strict';

import { CatalogSearchService } from '../../core/services/index.js';
import { CatalogSearchPort, assertImplements } from '../../core/ports/index.js';
import { NotFoundError, ValidationError } from '../../core/domain/errors.js';
import {
  InMemoryPreferenceRepository,
  InMemoryProductRepository,
  InMemoryStoreRepository,
  buildPreference,
  buildProduct,
  buildStore,
} from '../mocks/index.js';

async function setup() {
  const storeRepository = new InMemoryStoreRepository();
  const productRepository = new InMemoryProductRepository();
  const preferenceRepository = new InMemoryPreferenceRepository();
  const bogota = await storeRepository.create(buildStore({ name: 'Tienda Bogotá' }));
  const cali = await storeRepository.create(buildStore({ name: 'Tienda Cali' }));

  const [shirtBlack, shirtWhite, jeans, sneakers, hidden] = productRepository.seed(
    buildProduct({ name: 'Camiseta oversize', brand: 'Koaj', color: 'black', priceCop: 59900, storeId: bogota.id,
      sizeStocks: [{ size: 'M', isAvailable: true }, { size: 'L', isAvailable: false }] }),
    buildProduct({ name: 'Camiseta básica', brand: 'Koaj', color: 'white', priceCop: 39900, storeId: cali.id }),
    buildProduct({ name: 'Jean recto', brand: 'Arturo Calle', category: 'bottom', color: 'navy', priceCop: 149900,
      material: 'Algodón', rating: 4.5, storeId: bogota.id,
      images: [{ imageUrl: 'https://cdn.example.co/a.jpg' }, { imageUrl: 'https://cdn.example.co/b.jpg', isPrimary: true }] }),
    buildProduct({ name: 'Tenis blancos', brand: 'Bosi', category: 'shoes', color: 'white', priceCop: 229900,
      storeId: cali.id, sizeStocks: [{ size: '40', isAvailable: true }] }),
    buildProduct({ name: 'Camiseta retirada', brand: 'Koaj', color: 'black', priceCop: 10000, isHidden: true,
      storeId: bogota.id }),
  );

  const service = new CatalogSearchService({ productRepository, storeRepository, preferenceRepository });
  return { service, productRepository, preferenceRepository, bogota, cali, shirtBlack, shirtWhite, jeans, sneakers, hidden };
}

test('implementa todos los métodos de CatalogSearchPort', async () => {
  const { service } = await setup();
  assert.doesNotThrow(() => assertImplements(service, CatalogSearchPort));
});

test('searchProducts combina texto, color y talla normalizados y oculta productos ocultos', async () => {
  const { service, productRepository, shirtBlack } = await setup();
  const page = await service.searchProducts({ text: ' camiseta ', colors: ['Negro'], sizes: ['Mediana'] });

  assert.deepEqual(page.items.map((p) => p.id), [shirtBlack.id]);
  assert.deepEqual(productRepository.lastCriteria.colors, ['black']);
  assert.deepEqual(productRepository.lastCriteria.sizes, ['M']);
  assert.equal(page.items[0].currency, 'COP');
  assert.equal(page.items[0].priceCop, 59900);
  assert.deepEqual(page.items[0].store, { id: shirtBlack.storeId, name: 'Tienda Bogotá' });
  assert.deepEqual(page.items[0].availableSizes, ['M']);
});

test('searchProducts filtra por precio, marca, categoría y tienda, y ordena por precio', async () => {
  const { service, cali, shirtWhite, sneakers, jeans } = await setup();

  let page = await service.searchProducts({ minPrice: 40000, maxPrice: 200000, sort: 'price_desc' });
  assert.deepEqual(page.items.map((p) => p.priceCop), [149900, 59900]);

  page = await service.searchProducts({ includeStoreIds: [cali.id], sort: 'price_asc' });
  assert.deepEqual(page.items.map((p) => p.id), [shirtWhite.id, sneakers.id]);

  page = await service.searchProducts({ brands: ['Arturo Calle'], categories: ['bottom'] });
  assert.deepEqual(page.items.map((p) => p.id), [jeans.id]);

  page = await service.searchProducts({ excludeStoreIds: [cali.id], categories: ['top'] });
  assert.equal(page.totalItems, 1);
});

test('searchProducts acota la paginación y valida los filtros', async () => {
  const { service, productRepository } = await setup();

  const page = await service.searchProducts({ page: 0, pageSize: 999 });
  assert.equal(productRepository.lastCriteria.page, 1);
  assert.equal(productRepository.lastCriteria.pageSize, 50);
  assert.equal(page.totalItems, 4);

  await service.searchProducts({ page: 2, pageSize: 3 });
  assert.equal(productRepository.lastCriteria.page, 2);
  assert.equal(productRepository.lastCriteria.pageSize, 3);

  await assert.rejects(service.searchProducts({ minPrice: 200000, maxPrice: 100000 }), ValidationError);
  await assert.rejects(service.searchProducts({ minPrice: -1 }), ValidationError);
  await assert.rejects(service.searchProducts({ sort: 'newest' }), ValidationError);
  await assert.rejects(service.searchProducts({ categories: ['accesorios'] }), ValidationError);
});

test('searchProducts puede usar el rango de precios guardado en las preferencias', async () => {
  const { service, preferenceRepository, productRepository } = await setup();
  await preferenceRepository.upsert(buildPreference('user-1', { minPrice: 50000, maxPrice: 160000 }));

  const page = await service.searchProducts({ userId: 'user-1', usePreferredPriceRange: true });
  assert.deepEqual(page.items.map((p) => p.priceCop).sort(), [149900, 59900]);

  // Un rango explícito tiene prioridad sobre el guardado.
  await service.searchProducts({ userId: 'user-1', usePreferredPriceRange: true, maxPrice: 30000 });
  assert.equal(productRepository.lastCriteria.minPrice, null);
  assert.equal(productRepository.lastCriteria.maxPrice, 30000);
});

test('searchProducts descarta un producto oculto aunque el repositorio lo devuelva', async () => {
  const { service, productRepository, hidden } = await setup();
  productRepository.search = async ({ page, pageSize }) => ({
    items: [hidden], page, pageSize, totalItems: 1, totalPages: 1,
  });
  const page = await service.searchProducts({});
  assert.deepEqual(page.items, []);
});

test('getProductDetail incluye galería, tallas disponibles/no disponibles, tienda y enlace externo', async () => {
  const { service, shirtBlack } = await setup();
  const detail = await service.getProductDetail({ productId: shirtBlack.id });

  assert.deepEqual(detail.images, [{ url: 'https://cdn.example.co/img.jpg', isPrimary: true }]);
  assert.deepEqual(detail.sizes, [{ size: 'M', isAvailable: true }, { size: 'L', isAvailable: false }]);
  assert.equal(detail.store.name, 'Tienda Bogotá');
  assert.equal(detail.externalUrl, shirtBlack.externalUrl);
  assert.equal(detail.currency, 'COP');
});

test('getProductDetail responde NotFound si no existe o está oculto', async () => {
  const { service, hidden } = await setup();
  await assert.rejects(service.getProductDetail({ productId: 'product-999' }), NotFoundError);
  await assert.rejects(service.getProductDetail({ productId: hidden.id }), NotFoundError);
  await assert.rejects(service.getProductDetail({}), ValidationError);
});

test('compareProducts devuelve los productos lado a lado en el orden pedido', async () => {
  const { service, jeans, sneakers } = await setup();
  const { products } = await service.compareProducts({ productIds: [sneakers.id, jeans.id, sneakers.id] });

  assert.deepEqual(products.map((p) => p.id), [sneakers.id, jeans.id]);
  const [, jeansRow] = products;
  assert.equal(jeansRow.priceCop, 149900);
  assert.equal(jeansRow.brand, 'Arturo Calle');
  assert.equal(jeansRow.material, 'Algodón');
  assert.equal(jeansRow.color, 'navy');
  assert.equal(jeansRow.rating, 4.5);
  assert.equal(jeansRow.store.name, 'Tienda Bogotá');
  assert.ok(Array.isArray(jeansRow.sizes));
});

test('compareProducts exige entre 2 y 4 productos distintos y disponibles', async () => {
  const { service, jeans, sneakers, hidden, shirtBlack, shirtWhite } = await setup();
  await assert.rejects(service.compareProducts({ productIds: [jeans.id] }), ValidationError);
  await assert.rejects(service.compareProducts({ productIds: [jeans.id, jeans.id] }), ValidationError);
  await assert.rejects(service.compareProducts({}), ValidationError);
  await assert.rejects(
    service.compareProducts({ productIds: [jeans.id, sneakers.id, shirtBlack.id, shirtWhite.id, 'product-99'] }),
    ValidationError,
  );
  await assert.rejects(service.compareProducts({ productIds: [jeans.id, 'product-99'] }), NotFoundError);
  await assert.rejects(service.compareProducts({ productIds: [jeans.id, hidden.id] }), NotFoundError);
});

test('listActiveStores y getCatalogFacets devuelven tiendas activas y facetas visibles', async () => {
  const { service, bogota, cali } = await setup();
  const stores = await service.listActiveStores();
  assert.deepEqual(stores.items, [
    { id: bogota.id, name: 'Tienda Bogotá' },
    { id: cali.id, name: 'Tienda Cali' },
  ]);

  const facets = await service.getCatalogFacets();
  assert.deepEqual(facets.colors, ['black', 'navy', 'white']);
  assert.deepEqual(facets.sizes, ['40', 'M']);
  assert.deepEqual(facets.brands, ['Arturo Calle', 'Bosi', 'Koaj']);
  assert.deepEqual(facets.priceRange, { min: 39900, max: 229900 });
});

test('searchProducts filtra por ids omitiendo productos ocultos o inexistentes', async () => {
  const { service, productRepository, shirtBlack, jeans, hidden } = await setup();
  const page = await service.searchProducts({ ids: [shirtBlack.id, jeans.id, hidden.id, 'no-existe'] });

  assert.deepEqual(productRepository.lastCriteria.ids, [shirtBlack.id, jeans.id, hidden.id, 'no-existe']);
  assert.deepEqual(page.items.map((p) => p.id), [shirtBlack.id, jeans.id]);
  assert.equal(page.totalItems, 2);
});
