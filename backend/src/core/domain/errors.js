/**
 * Jerarquía de errores de dominio.
 *
 * Los mensajes están pensados para el usuario final (español claro, sin jerga).
 * El dominio no conoce códigos HTTP: el adaptador de entrada traduce cada tipo
 * (`error.code`) a su estado correspondiente.
 */
export class DomainError extends Error {
  /**
   * @param {string} message Mensaje listo para mostrar al usuario.
   * @param {{ code?: string, field?: string }} [options]
   */
  constructor(message, { code = 'DOMAIN_ERROR', field } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (field) this.field = field;
  }
}

/** Datos que no cumplen las reglas del negocio. */
export class ValidationError extends DomainError {
  constructor(message = 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.', options = {}) {
    super(message, { ...options, code: 'VALIDATION_ERROR' });
  }
}

/** La persona no se ha identificado o su sesión no es válida. */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Necesitas iniciar sesión para continuar.', options = {}) {
    super(message, { ...options, code: 'UNAUTHORIZED' });
  }
}

/** La persona está identificada pero no tiene permiso para la acción. */
export class ForbiddenError extends DomainError {
  constructor(message = 'No tienes permiso para realizar esta acción.', options = {}) {
    super(message, { ...options, code: 'FORBIDDEN' });
  }
}

/** El recurso solicitado no existe. */
export class NotFoundError extends DomainError {
  constructor(message = 'No encontramos lo que buscas.', options = {}) {
    super(message, { ...options, code: 'NOT_FOUND' });
  }
}

/** La acción choca con el estado actual (p. ej. un correo ya registrado). */
export class ConflictError extends DomainError {
  constructor(message = 'Esta acción no se puede completar porque entra en conflicto con información existente.', options = {}) {
    super(message, { ...options, code: 'CONFLICT' });
  }
}
