import { notImplemented } from '../../contract.js';

/**
 * Datos mínimos que viajan dentro del token. Nada sensible.
 * @typedef {Object} TokenPayload
 * @property {string} sub  id del usuario.
 * @property {'user'|'admin'} role
 */

/**
 * @typedef {Object} SignedToken
 * @property {string} token
 * @property {number} expiresInSeconds 900 (15 min) en la implementación JWT.
 */

/**
 * Estrategia de emisión y validación de tokens de acceso (RNF-07).
 * Implementación prevista: JWT HS256/RS256 de 15 minutos + lista de
 * revocados para el logout (FR-02).
 */
export class TokenService {
  /**
   * @param {TokenPayload} payload
   * @returns {Promise<SignedToken>}
   */
  async sign(payload) {
    notImplemented('TokenService', 'sign');
  }

  /**
   * Valida firma, expiración y que el token no haya sido revocado.
   * Si no es válido debe lanzar `UnauthorizedError` del dominio.
   * @param {string} token
   * @returns {Promise<TokenPayload>}
   */
  async verify(token) {
    notImplemented('TokenService', 'verify');
  }

  /**
   * Invalida el token hasta su expiración natural (logout).
   * Debe ser idempotente: revocar dos veces no es un error.
   * @param {string} token
   * @returns {Promise<void>}
   */
  async revoke(token) {
    notImplemented('TokenService', 'revoke');
  }
}
