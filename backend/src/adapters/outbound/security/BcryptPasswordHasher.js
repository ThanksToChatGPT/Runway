import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../../core/ports/index.js';
import { ValidationError } from '../../../core/domain/index.js';

/** RNF-06: factor de trabajo mínimo aceptado. */
export const MIN_BCRYPT_COST = 12;
/** bcrypt ignora en silencio lo que pase de 72 bytes: se rechaza en vez de truncar. */
const BCRYPT_MAX_BYTES = 72;

/**
 * Adapter: `PasswordHasher` con el algoritmo bcrypt.
 * Usa `bcryptjs` (implementación en JavaScript puro, mismo formato de hash `$2b$`):
 * no necesita compilar binarios nativos en Docker ni en Windows.
 */
export class BcryptPasswordHasher extends PasswordHasher {
  #cost;

  /** @param {{ cost?: number }} [options] */
  constructor({ cost = MIN_BCRYPT_COST } = {}) {
    super();
    if (!Number.isInteger(cost) || cost < MIN_BCRYPT_COST) {
      throw new Error(`El costo de bcrypt debe ser un entero >= ${MIN_BCRYPT_COST}.`);
    }
    this.#cost = cost;
  }

  /** Lee `BCRYPT_COST` del entorno (nunca por debajo del mínimo). */
  static fromEnv() {
    const cost = Number.parseInt(process.env.BCRYPT_COST ?? '', 10);
    return new BcryptPasswordHasher({ cost: Number.isInteger(cost) ? Math.max(cost, MIN_BCRYPT_COST) : MIN_BCRYPT_COST });
  }

  async hash(plainPassword) {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
      throw new ValidationError('La contraseña es obligatoria.', { field: 'password' });
    }
    if (Buffer.byteLength(plainPassword, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new ValidationError('La contraseña es demasiado larga.', { field: 'password' });
    }
    return bcrypt.hash(plainPassword, this.#cost);
  }

  /** Comparación en tiempo constante. Un hash corrupto cuenta como "no coincide". */
  async compare(plainPassword, passwordHash) {
    if (typeof plainPassword !== 'string' || typeof passwordHash !== 'string') return false;
    try {
      return await bcrypt.compare(plainPassword, passwordHash);
    } catch {
      return false;
    }
  }
}
