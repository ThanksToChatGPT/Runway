import type { Category, OutfitItem, ProductDetail } from '@/types';

export const CATEGORIES: Record<Category, string> = {
  top: 'Parte superior',
  bottom: 'Parte inferior',
  shoes: 'Calzado',
};

export const SLOT_ORDER: Category[] = ['top', 'bottom', 'shoes'];

export const SLOT_ICONS: Record<Category, string> = {
  top: '👕',
  bottom: '👖',
  shoes: '👟',
};

export const COLOR_HEX: Record<string, string> = {
  black: '#1f1d1a',
  white: '#f4f0e8',
  gray: '#8b8f9c',
  blue: '#3b6ea5',
  navy: '#1e3252',
  red: '#9a3b26',
  green: '#2e6b3f',
  yellow: '#d4a738',
  orange: '#d96b27',
  pink: '#d47c99',
  purple: '#6b4d8a',
  brown: '#6f4e37',
  beige: '#d8c7ab',
  multicolor: '#b98a2f',
};

export const COLOR_ES: Record<string, string> = {
  black: 'Negro',
  white: 'Blanco',
  gray: 'Gris',
  blue: 'Azul',
  navy: 'Azul marino',
  red: 'Rojo',
  green: 'Verde',
  yellow: 'Amarillo',
  orange: 'Naranja',
  pink: 'Rosado',
  purple: 'Morado',
  brown: 'Café',
  beige: 'Beige',
  multicolor: 'Multicolor',
};

export function colorHex(color?: string | null): string {
  if (!color) return '#8b8f9c';
  return COLOR_HEX[color.toLowerCase()] ?? '#8b8f9c';
}

export function colorLabel(color?: string | null): string {
  if (!color) return 'Sin color';
  return COLOR_ES[color.toLowerCase()] ?? color;
}

export function productGroup(p: {
  category: Category;
  subcategory?: string | null;
  color?: string | null;
}): string {
  return `${p.subcategory || p.category}:${p.color || 'neutral'}`;
}

export function productDetailToOutfitItem(detail: ProductDetail): OutfitItem {
  const primary =
    detail.images.find((img) => img.isPrimary)?.url ??
    detail.images[0]?.url ??
    null;
  return {
    id: detail.id,
    name: detail.name,
    brand: detail.brand,
    category: detail.category,
    subcategory: detail.subcategory,
    color: detail.color,
    priceCop: detail.priceCop,
    primaryImageUrl: primary,
    externalUrl: detail.externalUrl,
    store: detail.store,
  };
}

// FR-22 / US-41: marca el precio más bajo entre equivalentes de distintas tiendas (mismo `group`).
export function cheapestIds<
  T extends {
    id: string;
    category: Category;
    subcategory?: string | null;
    color?: string | null;
    priceCop: number;
  },
>(list: T[]): Set<string> {
  const groups: Record<string, T[]> = {};
  for (const p of list) {
    const g = productGroup(p);
    (groups[g] ??= []).push(p);
  }
  const ids = new Set<string>();
  for (const g of Object.values(groups)) {
    if (g.length < 2) continue;
    const min = Math.min(...g.map((p) => p.priceCop));
    for (const p of g) {
      if (p.priceCop === min) ids.add(p.id);
    }
  }
  return ids;
}

// FR-20 / US-37: "También te puede gustar" — parecidos por tipo (group), color y precio cercano.
export function similarProducts<
  T extends {
    id: string;
    category: Category;
    subcategory?: string | null;
    color?: string | null;
    brand?: string | null;
    priceCop: number;
  },
>(
  list: T[],
  target: {
    id: string;
    category: Category;
    subcategory?: string | null;
    color?: string | null;
    brand?: string | null;
    priceCop: number;
  },
  n = 4,
): T[] {
  const targetGroup = productGroup(target);
  const close = Math.max(30000, target.priceCop * 0.6);
  return list
    .filter((x) => x.id !== target.id && x.category === target.category)
    .map((x) => ({
      x,
      score:
        (productGroup(x) === targetGroup ? 2 : 0) +
        (Boolean(target.color) && x.color === target.color ? 1.5 : 0) +
        (Math.abs(x.priceCop - target.priceCop) <= close ? 1 : 0) +
        (Boolean(target.brand) && x.brand === target.brand ? 0.5 : 0),
    }))
    .filter((s) => s.score >= 1.5)
    .sort((a, b) => b.score - a.score || a.x.priceCop - b.x.priceCop)
    .slice(0, n)
    .map((s) => s.x);
}

export function formatUpdatedAt(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO');
}
