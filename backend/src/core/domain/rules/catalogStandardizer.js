import { CATEGORIES } from '../constants.js';

/**
 * Reglas puras para unificar los atributos que llegan de distintas tiendas
 * y para excluir contenido adulto restringido del catálogo.
 * Ninguna función tiene efectos secundarios ni depende de infraestructura.
 */

/** Minúsculas, sin tildes, sin signos y con espacios simples. */
export function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.+]+/g, ' ')
    .trim();
}

function tokenize(value) {
  const text = normalizeText(value);
  return text ? text.split(' ') : [];
}

/** Convierte { canonico: [sinónimos] } en un Map sinónimo -> canónico. */
function buildLookup(dictionary) {
  const lookup = new Map();
  for (const [canonical, synonyms] of Object.entries(dictionary)) {
    lookup.set(canonical, canonical);
    for (const synonym of synonyms) lookup.set(normalizeText(synonym), canonical);
  }
  return lookup;
}

/**
 * Busca primero el texto completo y luego palabra por palabra (la primera que
 * coincida gana), para resolver casos como "Azul oscuro" o "Camiseta básica".
 */
function resolve(lookup, value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (lookup.has(text)) return lookup.get(text);
  for (const token of text.split(' ')) {
    if (lookup.has(token)) return lookup.get(token);
  }
  return undefined;
}

// ---------------------------------------------------------------- Colores

const COLOR_LOOKUP = buildLookup({
  black: ['negro', 'negra', 'negros', 'negras', 'blk', 'blck', 'noir'],
  white: ['blanco', 'blanca', 'blancos', 'blancas', 'wht', 'wh', 'hueso', 'marfil', 'off white'],
  gray: ['gris', 'grises', 'grey', 'gry', 'gra', 'plata', 'silver', 'plateado', 'grafito', 'charcoal'],
  blue: ['azul', 'azules', 'blu', 'celeste', 'turquesa', 'denim', 'indigo'],
  navy: ['azul marino', 'azul oscuro', 'marino', 'nvy', 'navy blue'],
  red: ['rojo', 'roja', 'rojos', 'rojas', 'rd', 'vinotinto', 'vino', 'burgundy', 'granate'],
  green: ['verde', 'verdes', 'grn', 'oliva', 'olive', 'militar', 'khaki verde'],
  yellow: ['amarillo', 'amarilla', 'ylw', 'mostaza', 'mustard'],
  orange: ['naranja', 'anaranjado', 'org', 'coral'],
  pink: ['rosado', 'rosada', 'rosa', 'fucsia', 'pnk'],
  purple: ['morado', 'morada', 'lila', 'violeta', 'purpura', 'prp'],
  brown: ['cafe', 'marron', 'chocolate', 'camel', 'brn', 'cognac'],
  beige: ['crema', 'arena', 'nude', 'khaki', 'caqui', 'kaki', 'cream', 'sand'],
  multicolor: ['multicolor', 'estampado', 'print', 'multi'],
});

/**
 * "negro", "Black", "BLK" -> "black". Si el color no se reconoce se devuelve
 * el texto limpio para no perder información; vacío -> null.
 */
export function normalizeColor(raw) {
  const result = resolve(COLOR_LOOKUP, raw);
  if (result === undefined) return normalizeText(raw);
  return result;
}

// ---------------------------------------------------------------- Tallas

const SIZE_LOOKUP = buildLookup({
  XXS: ['2xs', 'xxs', 'extra extra pequena'],
  XS: ['xs', 'extra pequena', 'extra pequeno', 'extra small', 'x small'],
  S: ['s', 'pequena', 'pequeno', 'small', 'p', 'ch', 'chica'],
  M: ['m', 'mediana', 'mediano', 'medium', 'med'],
  L: ['l', 'grande', 'large', 'g', 'lg'],
  XL: ['xl', 'extra grande', 'extra large', 'x large', 'xg'],
  XXL: ['xxl', '2xl', 'xx large', 'xxg'],
  XXXL: ['xxxl', '3xl', 'xxx large'],
  UNICA: ['unica', 'talla unica', 'one size', 'os', 'u', 'tu', 'unitalla'],
});

// Prefijos que las tiendas anteponen a la talla ("Talla M", "EU 40", "Size 32").
const SIZE_PREFIXES = new Set(['talla', 'size', 'eu', 'us', 'col', 'co', 'uk', 'mx']);

/**
 * "m", "Mediana", "Talla M" -> "M"; "EU 40", "40.0" -> "40".
 * Tallas no reconocidas se devuelven en mayúsculas; vacío -> null.
 */
export function normalizeSize(raw) {
  // "38,5" -> "38.5" antes de tokenizar (la coma separaría el número).
  const tokens = tokenize(String(raw ?? '').replace(',', '.')).filter((t) => !SIZE_PREFIXES.has(t));
  if (tokens.length === 0) return null;
  const text = tokens.join(' ');

  if (SIZE_LOOKUP.has(text)) return SIZE_LOOKUP.get(text);
  if (/^\d+(\.\d+)?$/.test(text)) return String(Number(text));
  return text.toUpperCase();
}

// ---------------------------------------------------------------- Categorías

const CATEGORY_LOOKUP = buildLookup({
  [CATEGORIES.TOP]: [
    'top', 'tops', 'camiseta', 'camisetas', 'camisa', 'camisas', 'blusa', 'blusas', 'polo', 'polos',
    'buzo', 'buzos', 'hoodie', 'hoodies', 'sueter', 'sueteres', 'sweater', 'saco', 'sacos',
    'chaqueta', 'chaquetas', 'jacket', 'chaleco', 'abrigo', 'shirt', 'shirts', 'tshirt', 'tee',
    'crop', 'body', 'esqueleto', 'esqueletos', 'cardigan', 'parte superior',
  ],
  [CATEGORIES.BOTTOM]: [
    'bottom', 'bottoms', 'pantalon', 'pantalones', 'jean', 'jeans', 'short', 'shorts', 'bermuda',
    'bermudas', 'falda', 'faldas', 'jogger', 'joggers', 'leggings', 'leggins', 'licra', 'pants',
    'trousers', 'skirt', 'cargo', 'parte inferior',
  ],
  [CATEGORIES.SHOES]: [
    'shoes', 'zapato', 'zapatos', 'tenis', 'sneaker', 'sneakers', 'bota', 'botas', 'botin',
    'botines', 'sandalia', 'sandalias', 'mocasin', 'mocasines', 'calzado', 'tacon', 'tacones',
    'baleta', 'baletas', 'chancla', 'chanclas', 'footwear', 'boots', 'loafers',
  ],
});

/**
 * Asigna la categoría estándar del MVP a partir del texto de la tienda
 * (categoría, subcategoría o nombre). Devuelve null si no es top/bottom/shoes
 * (p. ej. accesorios), para que la ingesta pueda descartarlo.
 */
export function normalizeCategory(...candidates) {
  for (const candidate of candidates) {
    const result = resolve(CATEGORY_LOOKUP, candidate);
    if (result) return result;
  }
  return null;
}

// ---------------------------------------------------------------- Contenido restringido

/**
 * Términos que identifican productos sexualmente explícitos o de tienda para
 * adultos. Se comparan como palabras/frases completas para no afectar ropa
 * normal (ropa interior, lencería, vestidos de baño, tallas "XXXL", etc.).
 */
const RESTRICTED_TERMS = [
  'sex shop', 'sexshop', 'sexy shop', 'juguete sexual', 'juguetes sexuales', 'sex toy', 'sex toys',
  'adult toy', 'consolador', 'consoladores', 'dildo', 'dildos', 'vibrador', 'vibradores',
  'masturbador', 'plug anal', 'anal plug', 'strap on', 'lubricante intimo', 'lubricante sexual',
  'erotico', 'erotica', 'eroticos', 'eroticas', 'erotic', 'fetiche', 'fetish', 'bondage', 'bdsm',
  'porno', 'porn', 'xxx', 'nsfw', 'desnudo', 'desnuda', 'nude photo',
].map(normalizeText);

/** Texto plano del producto donde se buscan términos restringidos. */
function productText(product) {
  const fields = [product?.name, product?.brand, product?.category, product?.subcategory, product?.description];
  return ` ${fields.map(normalizeText).filter(Boolean).join(' ')} `;
}

export function isRestrictedContent(product) {
  const text = productText(product);
  return RESTRICTED_TERMS.some((term) => text.includes(` ${term} `));
}

export function filterRestrictedProducts(products) {
  return (products ?? []).filter((product) => !isRestrictedContent(product));
}

// ---------------------------------------------------------------- Conveniencia

function standardizeSizes(rawSizes) {
  const bySize = new Map();
  for (const entry of rawSizes ?? []) {
    const isObject = entry !== null && typeof entry === 'object';
    const size = normalizeSize(isObject ? entry.size : entry);
    if (!size) continue;
    const isAvailable = isObject ? Boolean(entry.isAvailable ?? entry.in_stock ?? true) : true;
    bySize.set(size, (bySize.get(size) ?? false) || isAvailable);
  }
  return [...bySize.entries()].map(([size, isAvailable]) => ({ size, isAvailable }));
}

/**
 * Estandariza un ítem crudo del scraper sin mutarlo.
 * Devuelve null si el ítem es contenido restringido o no pertenece a una
 * categoría del MVP.
 */
export function standardizeCatalogItem(raw) {
  if (!raw || isRestrictedContent(raw)) return null;
  const category = normalizeCategory(raw.category, raw.subcategory, raw.name);
  if (!category) return null;

  return {
    ...raw,
    category,
    color: normalizeColor(raw.color) || null,
    sizes: standardizeSizes(raw.sizes),
  };
}
