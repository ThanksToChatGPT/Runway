// Adaptador del scraper real (Outfit Scraper): lee su API HTTP (viewer server, `python -m outfit_scraper serve`).
// Mismo contrato que InMemoryProductRepository: findAll / findById / listStores (puerto ProductRepository).
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8060';

// Colores normalizados por el scraper → hex para la ficha y nombre en español (BR-consistencia con la UI).
const COLOR_HEX = {black: '#1b1b1f', white: '#efe9dc', gray: '#8b8f9c', blue: '#3b5f9e', green: '#3a6b4f',
  pink: '#d98ba0', yellow: '#e0b64c', brown: '#7a5240', red: '#a42525', beige: '#d9c9b2', purple: '#7b5ea7'};
const COLOR_ES = {black: 'Negro', white: 'Blanco', gray: 'Gris', blue: 'Azul', green: 'Verde', pink: 'Rosa',
  yellow: 'Amarillo', brown: 'Café', red: 'Rojo', beige: 'Beige', purple: 'Morado'};

// El clasificador del scraper deja tanks, vestidos, faldas y chalecos en "other"; el nombre dice qué son.
const OTHER_RULES = [[/^(vestido|enterizo)/i, 'full'], [/^(falda|minifalda)/i, 'bottom'], [/^(tank|chaleco)/i, 'top']];
const CATEGORY_OF = {top: 'top', bottom: 'bottom', footwear: 'shoes', accessory: 'acc'};

function mapCategory(row) {
  if (row.category === 'other') return OTHER_RULES.find(([re]) => re.test(row.name))?.[1] ?? 'acc';
  return CATEGORY_OF[row.category] ?? 'acc';
}

const fmtDate = iso => { try { const d = new Date(iso); return d.toLocaleDateString('es-CO'); } catch { return '—'; } };

// Mapeo fila del scraper → producto del dominio. Lo comparten la API viva y el snapshot JSON.
export function toProduct(row) {
  const color = row.color || 'gray';
  return {
    id: row.id, name: row.name, brand: row.brand || '—', store: row.store_name,
    category: mapCategory(row), color: COLOR_HEX[color] || '#8b8f9c', colorName: COLOR_ES[color] || color,
    price: row.price_cop, secondHand: false, group: `${row.subcategory || row.category}:${color}`,
    priceEstimated: false, hidden: false, material: row.material || '',
    images: (row.images || []).map(i => i.url), cutout: null, url: row.external_url,
    updatedAt: fmtDate(row.updated_at),
    sizes: (row.sizes || []).map(z => ({size: z.size, available: z.available}))
  };
}

export class HttpProductRepository {
  #cache = null;

  async #get(path) {
    let res;
    try { res = await fetch(API_BASE + path); }
    catch { const e = new Error('No puedo conectar con el scraper.'); e.code = 'API_UNREACHABLE'; throw e; }
    if (!res.ok) throw new Error(`El scraper respondió ${res.status}.`);
    return res.json();
  }

  // El visor entrega páginas de 200; se recorren todas para tener el catálogo completo en memoria.
  async findAll() {
    if (this.#cache) return this.#cache;
    const items = [];
    let offset = 0, total = Infinity;
    while (offset < total) {
      const page = await this.#get(`/api/products?single_garment=1&limit=200&offset=${offset}`);
      total = page.total; items.push(...page.items); offset += 200;
    }
    this.#cache = items.map(toProduct);
    return this.#cache;
  }

  async findById(id) { return (await this.findAll()).find(p => p.id === id) ?? null; }

  async listStores() { return (await this.#get('/api/stores')).map(s => s.name); }

  async ping() { await this.#get('/api/stats'); }
}
