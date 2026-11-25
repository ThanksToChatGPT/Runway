import { notImplemented } from '../contract.js';

/** @typedef {import('./dtos/authDtos.js').RegisterInput} RegisterInput */
/** @typedef {import('./dtos/authDtos.js').LoginInput} LoginInput */
/** @typedef {import('./dtos/authDtos.js').AccessTokenInput} AccessTokenInput */
/** @typedef {import('./dtos/authDtos.js').UserIdInput} UserIdInput */
/** @typedef {import('./dtos/authDtos.js').UpdatePreferencesInput} UpdatePreferencesInput */
/** @typedef {import('./dtos/authDtos.js').AuthSessionDto} AuthSessionDto */
/** @typedef {import('./dtos/authDtos.js').SessionUserDto} SessionUserDto */
/** @typedef {import('./dtos/authDtos.js').PreferencesSummaryDto} PreferencesSummaryDto */

/**
 * Casos de uso de cuenta y preferencias (US-1, US-2, US-11, US-14, US-15, US-17).
 * Errores esperados: `ValidationError`, `ConflictError` (email repetido),
 * `UnauthorizedError` (credenciales o sesión inválidas).
 */
export class AuthAndUserPort {
  /**
   * Registra un usuario local y abre su sesión (FR-01).
   * @param {RegisterInput} input
   * @returns {Promise<AuthSessionDto>}
   */
  async register(input) {
    notImplemented('AuthAndUserPort', 'register');
  }

  /**
   * Con credenciales incorrectas responde siempre el mismo mensaje genérico,
   * sin revelar si el email existe (FR-02).
   * @param {LoginInput} input
   * @returns {Promise<AuthSessionDto>}
   */
  async login(input) {
    notImplemented('AuthAndUserPort', 'login');
  }

  /**
   * Revoca el token actual. Idempotente.
   * @param {AccessTokenInput} input
   * @returns {Promise<void>}
   */
  async logout(input) {
    notImplemented('AuthAndUserPort', 'logout');
  }

  /**
   * Valida un token (firma, expiración, revocación) y devuelve quién es.
   * Lo usa el middleware HTTP para proteger rutas; así el logout tiene efecto.
   * @param {AccessTokenInput} input
   * @returns {Promise<SessionUserDto>}
   */
  async verifySession(input) {
    notImplemented('AuthAndUserPort', 'verifySession');
  }

  /**
   * Resumen consolidado de preferencias (US-17). Si el usuario no ha guardado
   * nada, devuelve las preferencias por defecto (todo en null).
   * @param {UserIdInput} input
   * @returns {Promise<PreferencesSummaryDto>}
   */
  async getPreferencesSummary(input) {
    notImplemented('AuthAndUserPort', 'getPreferencesSummary');
  }

  /**
   * Crea o edita rango de precios y presupuesto máximo (FR-10, FR-12).
   * @param {UpdatePreferencesInput} input
   * @returns {Promise<PreferencesSummaryDto>}
   */
  async updatePreferences(input) {
    notImplemented('AuthAndUserPort', 'updatePreferences');
  }
}
