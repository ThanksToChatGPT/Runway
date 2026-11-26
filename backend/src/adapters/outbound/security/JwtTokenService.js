import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../../core/ports/index.js';
import { ROLE_VALUES, UnauthorizedError } from '../../../core/domain/index.js';

const ALGORITHM = 'HS256';
/** RNF-07: tokens de acceso de 15 minutos. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** HS256 necesita una clave de al menos 256 bits (32 bytes). */
const MIN_SECRET_BYTES = 32;

const SESSION_EXPIRED = 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.';

/**
 * Adapter: `TokenService` con JWT firmado (HS256).
 *
 * Logout (FR-02): cada token lleva un `jti` único. Al revocarlo se guarda en
 * una lista en memoria hasta que el token expira solo. Es suficiente para el
 * MVP con una sola instancia del backend; con varias instancias o reinicios
 * habría que moverla a Redis o a una tabla.
 */
export class JwtTokenService extends TokenService {
  #secret;
  #ttlSeconds;
  #issuer;
  /** jti → instante de expiración (ms). */
  #revoked = new Map();
  #now;

  /**
   * @param {{ secret: string, expiresInSeconds?: number, issuer?: string, now?: () => number }} options
   */
  constructor({ secret, expiresInSeconds = ACCESS_TOKEN_TTL_SECONDS, issuer = 'outfit-builder-api', now = Date.now }) {
    super();
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
      throw new Error(`JWT_SECRET debe tener al menos ${MIN_SECRET_BYTES} caracteres.`);
    }
    this.#secret = secret;
    this.#ttlSeconds = expiresInSeconds;
    this.#issuer = issuer;
    this.#now = now;
  }

  /** Lee `JWT_SECRET` del entorno. */
  static fromEnv() {
    return new JwtTokenService({ secret: process.env.JWT_SECRET });
  }

  async sign({ sub, role }) {
    const token = jwt.sign({ role }, this.#secret, {
      algorithm: ALGORITHM,
      subject: String(sub),
      issuer: this.#issuer,
      expiresIn: this.#ttlSeconds,
      jwtid: randomUUID(),
    });
    return { token, expiresInSeconds: this.#ttlSeconds };
  }

  async verify(token) {
    const claims = this.#decodeVerified(token);
    if (!claims?.jti || !claims.sub || this.#isRevoked(claims.jti) || !ROLE_VALUES.includes(claims.role)) {
      throw new UnauthorizedError(SESSION_EXPIRED);
    }
    return { sub: claims.sub, role: claims.role };
  }

  /** Idempotente: un token inválido, vencido o ya revocado no produce error. */
  async revoke(token) {
    this.#pruneExpired();
    const claims = this.#decodeVerified(token);
    if (!claims?.jti) return;
    this.#revoked.set(claims.jti, claims.exp * 1000);
  }

  /** Solo confía en tokens con firma válida, algoritmo fijo y no vencidos. */
  #decodeVerified(token) {
    if (typeof token !== 'string' || token.length === 0) return null;
    try {
      return jwt.verify(token, this.#secret, {
        algorithms: [ALGORITHM],
        issuer: this.#issuer,
        clockTimestamp: Math.floor(this.#now() / 1000),
      });
    } catch {
      return null;
    }
  }

  #isRevoked(jti) {
    const expiresAt = this.#revoked.get(jti);
    return expiresAt !== undefined && expiresAt > this.#now();
  }

  // Un token vencido ya no pasa `verify`: no hace falta seguir recordándolo.
  #pruneExpired() {
    const now = this.#now();
    for (const [jti, expiresAt] of this.#revoked) {
      if (expiresAt <= now) this.#revoked.delete(jti);
    }
  }
}
