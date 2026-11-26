import { UnauthorizedError } from '../../../../core/domain/errors.js';

/** Extrae el token de `Authorization: Bearer <token>`; `null` si no viene. */
export function extractBearerToken(req) {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Eslabón de autenticación (Chain of Responsibility).
 *
 * Valida el token con `AuthAndUserPort.verifySession`, que delega en el
 * `TokenService` (firma, expiración y revocación por logout). Si es válido
 * adjunta `req.user = { id, role }` y `req.accessToken`; si no, corta la
 * cadena con `UnauthorizedError` (401).
 *
 * @param {import('../../../../core/ports/inbound/AuthAndUserPort.js').AuthAndUserPort} authService
 */
export function createAuthMiddleware(authService) {
  return async function authMiddleware(req, _res, next) {
    const accessToken = extractBearerToken(req);
    if (!accessToken) {
      return next(new UnauthorizedError('Necesitas iniciar sesión para continuar.'));
    }
    try {
      const session = await authService.verifySession({ accessToken });
      req.user = { id: session.userId, role: session.role };
      req.accessToken = accessToken;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Variante para endpoints públicos que se enriquecen si hay sesión
 * (p. ej. el catálogo con el rango de precios guardado, FR-10).
 * Un token ausente o inválido no bloquea: la petición sigue como anónima.
 */
export function createOptionalAuthMiddleware(authService) {
  return async function optionalAuthMiddleware(req, _res, next) {
    const accessToken = extractBearerToken(req);
    if (accessToken) {
      try {
        const session = await authService.verifySession({ accessToken });
        req.user = { id: session.userId, role: session.role };
      } catch {
        // Sesión inválida en un endpoint público: se atiende como anónimo.
      }
    }
    next();
  };
}
