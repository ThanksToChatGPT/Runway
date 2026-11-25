/**
 * Vocabularios cerrados del MVP (Release 1).
 * Son la única fuente de verdad para roles, slots y categorías dentro del dominio.
 */

export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const AUTH_PROVIDERS = Object.freeze({
  LOCAL: 'local',
});
export const AUTH_PROVIDER_VALUES = Object.freeze(Object.values(AUTH_PROVIDERS));

export const SLOT_TYPES = Object.freeze({
  TOP: 'top',
  BOTTOM: 'bottom',
  SHOES: 'shoes',
});
export const SLOT_TYPE_VALUES = Object.freeze(Object.values(SLOT_TYPES));

/** En el MVP cada categoría estándar corresponde 1:1 con un slot del outfit. */
export const CATEGORIES = Object.freeze({
  TOP: 'top',
  BOTTOM: 'bottom',
  SHOES: 'shoes',
});
export const CATEGORY_VALUES = Object.freeze(Object.values(CATEGORIES));

/** Nombres legibles para mostrar al usuario en mensajes. */
export const SLOT_LABELS = Object.freeze({
  top: 'parte superior',
  bottom: 'parte inferior',
  shoes: 'calzado',
});

export const RATING_RANGE = Object.freeze({ MIN: 0, MAX: 5 });
