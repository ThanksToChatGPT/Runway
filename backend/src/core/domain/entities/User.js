import { AUTH_PROVIDERS, AUTH_PROVIDER_VALUES, ROLES, ROLE_VALUES } from '../constants.js';
import { optionalText, requireOneOf, requireText } from '../guards.js';
import { ValidationError } from '../errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  constructor({
    id = null,
    email,
    passwordHash,
    authProvider = AUTH_PROVIDERS.LOCAL,
    name,
    country = null,
    role = ROLES.USER,
  }) {
    this.id = id;
    this.email = User.normalizeEmail(email);
    this.authProvider = requireOneOf(
      authProvider,
      AUTH_PROVIDER_VALUES,
      'El método de inicio de sesión no está disponible.',
      'authProvider',
    );
    this.passwordHash = requireText(passwordHash, 'La contraseña es obligatoria.', 'passwordHash');
    this.name = User.#validateName(name);
    this.country = optionalText(country);
    this.role = requireOneOf(role, ROLE_VALUES, 'El rol indicado no es válido.', 'role');
  }

  static normalizeEmail(email) {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!EMAIL_REGEX.test(normalized)) {
      throw new ValidationError('Ingresa un correo electrónico válido.', { field: 'email' });
    }
    return normalized;
  }

  static #validateName(name) {
    const text = requireText(name, 'El nombre es obligatorio.', 'name', { maxLength: 120 });
    if (text.length < 2) {
      throw new ValidationError('El nombre debe tener al menos 2 caracteres.', { field: 'name' });
    }
    return text;
  }

  isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  updateProfile({ name, country } = {}) {
    if (name !== undefined) this.name = User.#validateName(name);
    if (country !== undefined) this.country = optionalText(country);
    return this;
  }

  /** Datos seguros para exponer fuera del núcleo (nunca incluye el hash). */
  toPublicProfile() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      country: this.country,
      role: this.role,
    };
  }
}
