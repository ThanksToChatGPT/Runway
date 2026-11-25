import { notImplemented } from '../../contract.js';

/**
 * Estrategia de hashing de contraseñas (RNF-06).
 * Implementaciones previstas: bcrypt (costo >= 12) o Argon2id; un mock en tests.
 * El core nunca guarda ni compara contraseñas en texto plano.
 */
export class PasswordHasher {
  /**
   * @param {string} plainPassword
   * @returns {Promise<string>} hash listo para guardar en `users.password_hash`.
   */
  async hash(plainPassword) {
    notImplemented('PasswordHasher', 'hash');
  }

  /**
   * @param {string} plainPassword
   * @param {string} passwordHash
   * @returns {Promise<boolean>} true si coinciden. No lanza error si no coinciden.
   */
  async compare(plainPassword, passwordHash) {
    notImplemented('PasswordHasher', 'compare');
  }
}
