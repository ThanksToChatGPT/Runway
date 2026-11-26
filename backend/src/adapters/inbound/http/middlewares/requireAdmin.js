import { ForbiddenError, UnauthorizedError } from '../../../../core/domain/errors.js';
import { ROLES } from '../../../../core/domain/constants.js';

/**
 * Eslabón de autorización: va después de `authMiddleware` y solo deja pasar
 * a usuarios con rol `admin` (BR-16). El servicio vuelve a validarlo: esta
 * capa evita trabajo innecesario y da una respuesta temprana.
 */
export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new UnauthorizedError());
  if (req.user.role !== ROLES.ADMIN) {
    return next(new ForbiddenError('Esta sección es solo para administradores.'));
  }
  return next();
}
