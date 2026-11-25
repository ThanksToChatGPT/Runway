/**
 * DTOs de autenticación y preferencias (AuthAndUserPort).
 * Las entradas llegan como objetos planos desde HTTP; las salidas nunca
 * exponen entidades ni datos sensibles (p. ej. `passwordHash`).
 */

/** @typedef {import('../../../domain/entities/User.js').User} User */
/** @typedef {import('../../../domain/entities/UserPreference.js').UserPreference} UserPreference */

// ------------------------------------------------------------------ Entradas

/**
 * @typedef {Object} RegisterInput
 * @property {string} email
 * @property {string} password   texto plano; se valida la política y se hashea en el servicio.
 * @property {string} name
 * @property {string|null} [country]
 */

/**
 * @typedef {Object} LoginInput
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} AccessTokenInput
 * @property {string} accessToken token enviado en `Authorization: Bearer …`.
 */

/**
 * @typedef {Object} UserIdInput
 * @property {string} userId usuario autenticado (sale del token, nunca del body).
 */

/**
 * Solo se actualizan los campos presentes; `null` borra el valor.
 * @typedef {Object} UpdatePreferencesInput
 * @property {string} userId
 * @property {number|null} [minPrice]         COP.
 * @property {number|null} [maxPrice]         COP.
 * @property {number|null} [maxOutfitBudget]  COP.
 */

// ------------------------------------------------------------------- Salidas

/**
 * @typedef {Object} UserDto
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string|null} country
 * @property {'user'|'admin'} role
 */

/**
 * @typedef {Object} AuthSessionDto
 * @property {string} accessToken
 * @property {'Bearer'} tokenType
 * @property {number} expiresInSeconds
 * @property {UserDto} user
 */

/**
 * Identidad del usuario de una sesión válida (para el middleware HTTP).
 * @typedef {Object} SessionUserDto
 * @property {string} userId
 * @property {'user'|'admin'} role
 */

/**
 * @typedef {Object} PreferencesSummaryDto
 * @property {string} userId
 * @property {{ min: number|null, max: number|null }} priceRange
 * @property {number|null} maxOutfitBudget
 * @property {boolean} hasPriceRange
 * @property {boolean} hasBudget
 * @property {'COP'} currency
 */

// ------------------------------------------------------------------ Mappers

/** @param {User} user @returns {UserDto} */
export function toUserDto(user) {
  const { id, email, name, country, role } = user.toPublicProfile();
  return { id, email, name, country, role };
}

/**
 * @param {{ token: string, expiresInSeconds: number }} signedToken
 * @param {User} user
 * @returns {AuthSessionDto}
 */
export function toAuthSessionDto(signedToken, user) {
  return {
    accessToken: signedToken.token,
    tokenType: 'Bearer',
    expiresInSeconds: signedToken.expiresInSeconds,
    user: toUserDto(user),
  };
}

/** @param {UserPreference} preference @returns {PreferencesSummaryDto} */
export function toPreferencesSummaryDto(preference) {
  return preference.getSummary();
}
