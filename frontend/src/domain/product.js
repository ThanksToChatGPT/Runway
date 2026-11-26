export const CATEGORIES = {top:'Parte superior',bottom:'Parte inferior',full:'Prenda larga',outer:'Abrigo',shoes:'Calzado',acc:'Accesorio'};
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// FR-13/14/15/16: texto + precio + tienda + categoría + color + material combinables. Los ocultos (FR-36) no salen.
export function filterProducts(list, {query = '', stores = null, category = 'all', maxPrice = Infinity, colors = null, materials = null} = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return list.filter(p => !p.hidden
    && (!stores || stores.includes(p.store))
    && (category === 'all' || p.category === category)
    && p.price <= maxPrice
    && (!colors?.length || colors.includes(p.colorName))
    && (!materials?.length || materials.includes(p.material))
    && words.every(w => norm(`${p.name} ${p.brand} ${p.colorName} ${p.material}`).includes(w)));
}
export const sortByPrice = (list, dir = 'asc') => [...list].sort((a, b) => (dir === 'desc' ? b.price - a.price : a.price - b.price) || a.id.localeCompare(b.id));

// FR-22 / US-41: marca el precio más bajo entre equivalentes de distintas tiendas (mismo `group`).
export function cheapestIds(list) {
  const groups = {};
  list.forEach(p => (groups[p.group] ??= []).push(p));
  const ids = new Set();
  Object.values(groups).forEach(g => {
    if (g.length < 2) return;
    const min = Math.min(...g.map(p => p.price));
    g.filter(p => p.price === min).forEach(p => ids.add(p.id));
  });
  return ids;
}

// FR-20 / US-37: "También te puede gustar" — parecidos por tipo (group), color y precio cercano.
export function similarProducts(list, p, n = 4) {
  const close = Math.max(30000, p.price * 0.6);
  return list
    .filter(x => x.id !== p.id && x.category === p.category)
    .map(x => ({x, score: (x.group === p.group ? 2 : 0) + (x.colorName === p.colorName ? 1.5 : 0)
      + (Math.abs(x.price - p.price) <= close ? 1 : 0) + (x.brand === p.brand ? 0.5 : 0)}))
    .filter(s => s.score >= 1.5)
    .sort((a, b) => b.score - a.score || a.x.price - b.x.price)
    .slice(0, n).map(s => s.x);
}

// FR-19: la galería es una lista (mínimo una imagen cuando existan datos); la primera es la principal.
export const primaryImage = p => p.images?.[0] ?? null;
