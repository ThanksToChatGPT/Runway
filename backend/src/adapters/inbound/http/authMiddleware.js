import jwt from 'jsonwebtoken';
import { AppError } from '../../../core/domain/errors.js';

export function createAuthMiddleware(jwtSecret) {
  function requireAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return next(new AppError('Token de autenticación requerido', 401));
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      return next();
    } catch {
      return next(new AppError('Token inválido o expirado', 401));
    }
  }

  function requireAdmin(req, _res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return next(new AppError('Acceso restringido a administradores', 403));
    }
    return next();
  }

  return { requireAuth, requireAdmin };
}
