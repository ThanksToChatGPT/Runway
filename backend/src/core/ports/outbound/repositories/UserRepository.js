import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/User.js').User} User */

/**
 * Repositorio del agregado `User` (tabla `users`).
 * Trabaja con entidades del dominio, nunca con filas SQL.
 *
 * El email se busca ya normalizado (`User.normalizeEmail`).
 * Un email duplicado al crear debe traducirse a `ConflictError` del dominio.
 */
export class UserRepository {
  /**
   * @param {string} email email normalizado (minúsculas, sin espacios).
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    notImplemented('UserRepository', 'findByEmail');
  }

  /**
   * @param {string} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    notImplemented('UserRepository', 'findById');
  }

  /**
   * Persiste un usuario nuevo (`user.id` es null) y lo devuelve con su id.
   * @param {User} user
   * @returns {Promise<User>}
   */
  async create(user) {
    notImplemented('UserRepository', 'create');
  }
}
