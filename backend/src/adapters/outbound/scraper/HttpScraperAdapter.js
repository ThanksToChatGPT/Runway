import { ScraperPort } from '../../../core/ports/index.js';

export const DEFAULT_SCRAPER_TIMEOUT_MS = 15_000;

/**
 * Error técnico del adaptador. No es un `DomainError`: `AdminStoreService`
 * lo captura y responde `status: 'failed'` sin tocar el catálogo (RNF-13).
 * El mensaje nunca incluye la respuesta del servicio externo.
 */
export class ScraperUnavailableError extends Error {
  constructor(message, { cause, status } = {}) {
    super(message, { cause });
    this.name = 'ScraperUnavailableError';
    if (status) this.status = status;
  }
}

/** Primer valor no vacío entre los nombres posibles (snake_case o camelCase). */
function pick(raw, ...keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return null;
}

/** `slug` que espera el servicio Python para elegir su extractor. */
function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeRawSizes(sizes) {
  if (!Array.isArray(sizes)) return [];
  return sizes
    .map((entry) => {
      if (entry !== null && typeof entry === 'object') {
        const size = entry.size ?? entry.name ?? entry.label;
        if (size === null || size === undefined || String(size).trim() === '') return null;
        return {
          size: String(size),
          isAvailable: Boolean(entry.in_stock ?? entry.isAvailable ?? true),
        };
      }
      if (entry === null || entry === undefined || String(entry).trim() === '') return null;
      return { size: String(entry), isAvailable: true };
    })
    .filter(Boolean);
}

/**
 * Ítem del servicio Python → `RawScrapedProduct`. Solo traduce nombres de
 * campos; la limpieza y estandarización las hace el core (BR-02, BR-13).
 * Acepta tanto el formato actual del scraper (`title`, `product_url`,
 * `sizes: [{ size, in_stock }]`) como uno en camelCase o strings simples.
 */
export function toRawScrapedProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const images = pick(raw, 'imageUrls', 'image_urls', 'images');
  const sizes = pick(raw, 'sizes');

  return {
    name: pick(raw, 'name', 'title'),
    externalUrl: pick(raw, 'externalUrl', 'external_url', 'product_url', 'url'),
    priceCop: pick(raw, 'priceCop', 'price_cop', 'price'),
    brand: pick(raw, 'brand'),
    category: pick(raw, 'category'),
    subcategory: pick(raw, 'subcategory'),
    material: pick(raw, 'material'),
    color: pick(raw, 'color'),
    rating: pick(raw, 'rating'),
    isSecondHand: Boolean(pick(raw, 'isSecondHand', 'is_second_hand')),
    description: pick(raw, 'description'),
    imageUrls: Array.isArray(images)
      ? images.map((img) => (typeof img === 'string' ? img : img?.url)).filter((url) => typeof url === 'string')
      : [],
    sizes: normalizeRawSizes(sizes),
  };
}

/**
 * Adapter: `ScraperPort` sobre HTTP hacia el servicio Python (`POST /scrape`).
 *
 * - Timeout con `AbortSignal`: una tienda lenta nunca bloquea el backend.
 * - Cualquier falla (red, timeout, estado HTTP, JSON inválido) se convierte en
 *   `ScraperUnavailableError`, que el caso de uso aísla (BR-12).
 */
export class HttpScraperAdapter extends ScraperPort {
  #baseUrl;
  #timeoutMs;
  #fetch;

  /**
   * @param {{ baseUrl: string, timeoutMs?: number, fetchImpl?: typeof fetch }} options
   */
  constructor({ baseUrl, timeoutMs = DEFAULT_SCRAPER_TIMEOUT_MS, fetchImpl = globalThis.fetch }) {
    super();
    let url;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new Error('SCRAPER_URL no es una URL válida.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('SCRAPER_URL debe usar http o https.');
    }
    this.#baseUrl = url.href.replace(/\/+$/, '');
    this.#timeoutMs = timeoutMs;
    this.#fetch = fetchImpl;
  }

  /** Lee `SCRAPER_URL` (con fallback a `SCRAPER_SERVICE_URL`) y `SCRAPER_TIMEOUT_MS`. */
  static fromEnv() {
    const timeout = Number.parseInt(process.env.SCRAPER_TIMEOUT_MS ?? '', 10);
    return new HttpScraperAdapter({
      baseUrl: process.env.SCRAPER_URL || process.env.SCRAPER_SERVICE_URL || 'http://localhost:8000',
      timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : DEFAULT_SCRAPER_TIMEOUT_MS,
    });
  }

  async extractProductsByStore(store) {
    let response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          store_id: String(store.id),
          slug: slugify(store.name),
          base_url: store.baseUrl,
        }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new ScraperUnavailableError(
        timedOut ? 'El servicio de extracción no respondió a tiempo.' : 'No se pudo conectar con el servicio de extracción.',
        { cause: error },
      );
    }

    if (!response.ok) {
      // Se descarta el cuerpo para liberar la conexión sin exponer su contenido.
      await response.body?.cancel().catch(() => {});
      throw new ScraperUnavailableError(`El servicio de extracción respondió con estado ${response.status}.`, {
        status: response.status,
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ScraperUnavailableError('El servicio de extracción devolvió una respuesta inválida.', { cause: error });
    }

    const items = Array.isArray(payload) ? payload : payload?.products;
    if (!Array.isArray(items)) {
      throw new ScraperUnavailableError('El servicio de extracción devolvió una respuesta sin productos.');
    }
    return items.map(toRawScrapedProduct).filter(Boolean);
  }
}
