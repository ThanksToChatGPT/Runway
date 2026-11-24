import {filterProducts, sortByPrice, cheapestIds, similarProducts} from '../domain/product.js';
import {total, shoppingList} from '../domain/outfit.js';

// Fábrica de casos de uso (PUERTO PRIMARIO de entrada). Recibe los puertos por inyección.
export function createUseCases({products, outfits, auth}) {
  const needUser = () => { const u = auth.currentUser(); if (!u) throw new Error('AUTH_REQUIRED'); return u; };
  return {
    // Catálogo
    async searchProducts(criteria = {}) {
      const all = await products.findAll();
      let items = filterProducts(all, criteria);
      if (criteria.sort) items = sortByPrice(items, criteria.sort);
      return {items, cheapest: cheapestIds(all)};
    },
    getProduct: id => products.findById(id),
    async getProducts(ids) { return (await Promise.all(ids.map(i => products.findById(i)))).filter(Boolean); },
    listStores: () => products.listStores(),
    // FR-20 / US-37: sugerencias a partir del producto visto.
    async similarTo(id, n = 4) {
      const [p, all] = await Promise.all([products.findById(id), products.findAll()]);
      return p ? similarProducts(all, p, n) : [];
    },
    // US-21/22/25: valores disponibles para los filtros (colores, marcas, materiales).
    async filterOptions() {
      const all = await products.findAll();
      const uniq = f => [...new Set(all.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      return {colors: uniq(p => p.colorName), brands: uniq(p => p.brand), materials: uniq(p => p.material)};
    },
    // Outfits y favoritos (requieren sesión: FR-07)
    async saveOutfit(name, outfit) {
      const u = needUser();
      if (!name.trim()) throw new Error('NAME_REQUIRED');
      return outfits.save(u.id, {name: name.trim(), mode: outfit.mode, items: outfit.items, total: total(outfit)});
    },
    listSavedOutfits: async () => outfits.listSaved(needUser().id),
    toggleFavorite: async id => outfits.toggleFavorite(needUser().id, id),
    async listFavorites() { return this.getProducts(await outfits.listFavoriteIds(needUser().id)); },
    exportShoppingList: (outfit, name) => shoppingList(outfit, name),
    // Sesión
    currentUser: () => auth.currentUser(), login: () => auth.login(), logout: () => auth.logout()
  };
}
