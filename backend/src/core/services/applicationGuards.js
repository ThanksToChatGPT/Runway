import { ROLES } from '../domain/constants.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../domain/errors.js';

/**
 * Guard clauses (fail-fast) compartidas por los servicios de aplicación.
 * Cada una valida una precondición y lanza el `DomainError` correspondiente.
 */

/** El caso de uso exige una persona autenticada (el `userId` sale del token). */
export function requireAuthenticatedUser(userId) {
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    throw new UnauthorizedError();
  }
  return userId;
}

/** Solo un administrador puede gestionar tiendas (BR-16). */
export function requireAdmin(actor) {
  requireAuthenticatedUser(actor?.userId);
  if (actor.role !== ROLES.ADMIN) {
    throw new ForbiddenError('Solo un administrador puede gestionar las tiendas.');
  }
  return actor;
}

/** Devuelve la entidad o lanza `NotFoundError` con el mensaje dado. */
export function requireFound(entity, message) {
  if (!entity) throw new NotFoundError(message);
  return entity;
}

/** Índice id → tienda, para mostrar el nombre de la tienda de cada producto. */
export function indexStoresById(stores) {
  return new Map((stores ?? []).filter(Boolean).map((store) => [store.id, store]));
}
