import { notImplemented } from '../../contract.js';

/** @typedef {import('../../../domain/entities/UserPreference.js').UserPreference} UserPreference */

/**
 * Repositorio de `UserPreference` (tabla `user_preferences`, una fila por usuario).
 */
export class PreferenceRepository {
  /**
   * @param {string} userId
   * @returns {Promise<UserPreference|null>} null si el usuario aún no guardó preferencias.
   */
  async findByUserId(userId) {
    notImplemented('PreferenceRepository', 'findByUserId');
  }

  /**
   * Crea o actualiza las preferencias del usuario (`preference.userId`).
   * @param {UserPreference} preference
   * @returns {Promise<UserPreference>} preferencias persistidas, con id.
   */
  async upsert(preference) {
    notImplemented('PreferenceRepository', 'upsert');
  }
}
