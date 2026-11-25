import { AppError } from '../../../core/domain/errors.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
