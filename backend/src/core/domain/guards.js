import { ValidationError } from './errors.js';

/**
 * Validaciones pequeñas y reutilizables por las entidades.
 * Cada guard recibe el mensaje final para el usuario y el campo afectado.
 */

export function requireText(value, message, field, { maxLength } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new ValidationError(message, { field });
  if (maxLength && text.length > maxLength) {
    throw new ValidationError(`Este campo admite máximo ${maxLength} caracteres.`, { field });
  }
  return text;
}

export function optionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function requireId(value, message, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(message, { field });
  }
  return value;
}

/** Montos en pesos colombianos: números finitos, no negativos y sin decimales. */
export function requireCop(value, message, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(message, { field });
  }
  return Math.round(value);
}

export function optionalCop(value, message, field) {
  if (value === undefined || value === null) return null;
  return requireCop(value, message, field);
}

export function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function requireHttpUrl(value, message, field) {
  if (!isHttpUrl(value)) throw new ValidationError(message, { field });
  return value.trim();
}

export function optionalDate(value, message, field) {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(message, { field });
  return date;
}

export function requireOneOf(value, allowed, message, field) {
  if (!allowed.includes(value)) throw new ValidationError(message, { field });
  return value;
}
