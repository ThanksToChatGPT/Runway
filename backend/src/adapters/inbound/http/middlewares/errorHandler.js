import { DomainError } from '../../../../core/domain/errors.js';

/** Código de `DomainError` → estado HTTP. */
const STATUS_BY_CODE = Object.freeze({
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
});

const INTERNAL_ERROR = 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.';

/** Rutas inexistentes: 404 con el mismo formato que el resto de errores. */
export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'La ruta solicitada no existe.' });
}

/**
 * Último eslabón de la cadena: traduce cualquier error a
 * `{ error: "mensaje en español" }` sin exponer stack traces ni detalles
 * técnicos. Los errores inesperados se registran solo en el servidor.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return req.socket?.destroy();

  const { status, body } = toHttpError(err);
  if (status >= 500) {
    console.error(`[http] ${req.method} ${req.originalUrl} →`, err);
  }
  return res.status(status).json(body);
}

/** @returns {{ status: number, body: { error: string, field?: string } }} */
export function toHttpError(err) {
  if (err instanceof DomainError) {
    const status = STATUS_BY_CODE[err.code] ?? 400;
    const body = { error: err.message };
    if (err.field) body.field = err.field;
    return { status, body };
  }

  // Errores de `express.json()` (body-parser).
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, body: { error: 'El cuerpo de la petición no es un JSON válido.' } };
  }
  if (err?.type === 'entity.too.large') {
    return { status: 413, body: { error: 'El cuerpo de la petición es demasiado grande.' } };
  }

  return { status: 500, body: { error: INTERNAL_ERROR } };
}
