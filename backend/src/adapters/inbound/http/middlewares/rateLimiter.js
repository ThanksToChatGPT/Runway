/**
 * Rate limiting en memoria por IP con ventana fija.
 *
 * Suficiente para el MVP con una sola instancia del backend. Con varias
 * instancias habría que mover los contadores a Redis.
 *
 * Detrás de un proxy (Nginx, balanceador) configura `TRUST_PROXY` para que
 * `req.ip` sea la IP real del cliente y no la del proxy.
 */

const DEFAULT_MESSAGE = 'Hiciste demasiadas peticiones. Espera un momento e inténtalo de nuevo.';

/**
 * @param {Object} [options]
 * @param {number} [options.windowMs=60000]   duración de la ventana.
 * @param {number} [options.max=60]           peticiones permitidas por IP en la ventana.
 * @param {boolean} [options.skipSuccessfulRequests=false] solo cuenta respuestas con error (>= 400).
 * @param {string} [options.message]          mensaje en español para el 429.
 * @param {() => number} [options.now]        reloj inyectable (tests).
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  skipSuccessfulRequests = false,
  message = DEFAULT_MESSAGE,
  now = Date.now,
} = {}) {
  /** ip → { count, resetAt } */
  const hits = new Map();

  // Limpieza periódica para que el mapa no crezca sin límite.
  const cleanup = setInterval(() => {
    const current = now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= current) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  function rateLimiter(req, res, next) {
    const key = req.ip ?? 'unknown';
    const current = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - current) / 1000);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(remaining));
    res.set('RateLimit-Reset', String(resetSeconds));

    if (entry.count > max) {
      res.set('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: message });
    }

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
      });
    }
    return next();
  }

  rateLimiter.reset = () => hits.clear();
  return rateLimiter;
}

/** 60 peticiones por minuto por IP en endpoints públicos (RNF de disponibilidad). */
export function createPublicRateLimiter(options = {}) {
  return createRateLimiter({ windowMs: 60_000, max: 60, ...options });
}

/**
 * Protección básica contra fuerza bruta en `/auth/login`: 10 intentos
 * fallidos por IP cada 15 minutos. Los inicios de sesión exitosos no cuentan.
 */
export function createLoginRateLimiter(options = {}) {
  return createRateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    skipSuccessfulRequests: true,
    message: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.',
    ...options,
  });
}
