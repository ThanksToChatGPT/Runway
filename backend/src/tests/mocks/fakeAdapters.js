/**
 * Dobles de los puertos de seguridad y extracción. Deterministas y sin
 * dependencias: nada de bcrypt, JWT ni HTTP.
 */
import { PasswordHasher, ScraperPort, TokenService } from '../../core/ports/index.js';
import { UnauthorizedError } from '../../core/domain/errors.js';

export class FakePasswordHasher extends PasswordHasher {
  async hash(plain) {
    return `hashed:${plain}`;
  }

  async compare(plain, hash) {
    return hash === `hashed:${plain}`;
  }
}

/** Emite tokens opacos `token-N` y mantiene una lista de revocados. */
export class FakeTokenService extends TokenService {
  #active = new Map();
  #revoked = new Set();
  #next = 1;

  async sign({ sub, role }) {
    const token = `token-${this.#next++}`;
    this.#active.set(token, { sub, role });
    return { token, expiresInSeconds: 900 };
  }

  async verify(token) {
    const payload = this.#active.get(token);
    if (!payload || this.#revoked.has(token)) {
      throw new UnauthorizedError('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    return payload;
  }

  async revoke(token) {
    this.#revoked.add(token);
  }

  isRevoked(token) {
    return this.#revoked.has(token);
  }
}

/** Scraper configurable: devuelve los ítems indicados o lanza el error dado. */
export class FakeScraper extends ScraperPort {
  calls = [];

  constructor({ items = [], error = null } = {}) {
    super();
    this.items = items;
    this.error = error;
  }

  async extractProductsByStore(store) {
    this.calls.push(store.id);
    if (this.error) throw this.error;
    return this.items;
  }
}
