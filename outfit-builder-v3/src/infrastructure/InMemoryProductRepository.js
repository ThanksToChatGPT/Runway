import {RAW} from './data/catalog.js';
const STORE_URLS = {SHEIN:'https://www.shein.com.co', Temu:'https://www.temu.com', Vinted:'https://www.vinted.com', Falabella:'https://www.falabella.com.co'};
// Fotos de prueba generadas con scripts/generate-test-images.py. Con fotos reales, pon aquí sus URLs (WebP < 200 KB).
const IMG = `${import.meta.env.BASE_URL}images/products/`;
const ESTIMATED = new Set(['SHEIN', 'Temu']); // BR-03: precios convertidos a COP se marcan como estimados
const PRODUCTS = RAW.map(([name, brand, store, category, color, colorName, price, sh, group], i) => {
  const sizes = category === 'shoes' ? ['37','38','39','40','41','42'] : category === 'acc' ? ['Única'] : ['XS','S','M','L','XL'];
  return {id: String(i), name, brand, store, category, color, colorName, price, secondHand: !!sh, group: group || 'u' + i,
    priceEstimated: ESTIMATED.has(store), hidden: false, images: [1, 2].map(n => `${IMG}${i}-${n}.svg`), cutout: `${IMG}${i}-cut.svg`, url: STORE_URLS[store], updatedAt: `${18 + i % 6}/11/2026`,
    sizes: sizes.map((size, k) => ({size, available: sizes.length === 1 || (i * 7 + k * 3) % 5 !== 0}))};
});
// Adaptador de datos de ejemplo. Para usar el backend real, crea HttpProductRepository con los mismos 3 métodos.
export class InMemoryProductRepository {
  async findAll() { return PRODUCTS; }
  async findById(id) { return PRODUCTS.find(p => p.id === id) ?? null; }
  async listStores() { return Object.keys(STORE_URLS); }
}
