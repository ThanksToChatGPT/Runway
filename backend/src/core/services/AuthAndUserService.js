import { ROLES } from '../domain/constants.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { User } from '../domain/entities/User.js';
import { UserPreference } from '../domain/entities/UserPreference.js';
import { AuthAndUserPort } from '../ports/inbound/AuthAndUserPort.js';
import { toAuthSessionDto, toPreferencesSummaryDto } from '../ports/inbound/dtos/authDtos.js';
import { requireAuthenticatedUser } from './applicationGuards.js';

/** Política básica de contraseña del MVP (FR-01). 72 = límite de bcrypt. */
export const PASSWORD_POLICY = Object.freeze({ MIN_LENGTH: 8, MAX_LENGTH: 72 });

/** Mismo mensaje para email inexistente y contraseña errónea (FR-02). */
const INVALID_CREDENTIALS = 'El correo o la contraseña no son correctos.';

const PREFERENCE_FIELDS = ['minPrice', 'maxPrice', 'maxOutfitBudget'];

/**
 * Casos de uso de cuenta, sesión y preferencias.
 * Implementa `AuthAndUserPort`; recibe sus dependencias por constructor.
 */
export class AuthAndUserService extends AuthAndUserPort {
  #users;
  #preferences;
  #hasher;
  #tokens;

  /**
   * @param {Object} deps
   * @param {import('../ports/outbound/repositories/UserRepository.js').UserRepository} deps.userRepository
   * @param {import('../ports/outbound/repositories/PreferenceRepository.js').PreferenceRepository} deps.preferenceRepository
   * @param {import('../ports/outbound/security/PasswordHasher.js').PasswordHasher} deps.passwordHasher
   * @param {import('../ports/outbound/security/TokenService.js').TokenService} deps.tokenService
   */
  constructor({ userRepository, preferenceRepository, passwordHasher, tokenService }) {
    super();
    this.#users = userRepository;
    this.#preferences = preferenceRepository;
    this.#hasher = passwordHasher;
    this.#tokens = tokenService;
  }

  async register({ email, password, name, country = null } = {}) {
    const normalizedEmail = User.normalizeEmail(email);
    assertPasswordPolicy(password);
    if (await this.#users.findByEmail(normalizedEmail)) {
      throw new ConflictError('Ya existe una cuenta con este correo electrónico.', { field: 'email' });
    }

    const passwordHash = await this.#hasher.hash(password);
    const user = await this.#users.create(
      new User({ email: normalizedEmail, passwordHash, name, country, role: ROLES.USER }),
    );
    return this.#openSession(user);
  }

  async login({ email, password } = {}) {
    let normalizedEmail;
    try {
      normalizedEmail = User.normalizeEmail(email);
    } catch {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    if (typeof password !== 'string' || password === '') {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const user = await this.#users.findByEmail(normalizedEmail);
    const matches = user ? await this.#hasher.compare(password, user.passwordHash) : false;
    if (!matches) throw new UnauthorizedError(INVALID_CREDENTIALS);

    return this.#openSession(user);
  }

  async logout({ accessToken } = {}) {
    await this.#tokens.revoke(requireToken(accessToken));
  }

  async verifySession({ accessToken } = {}) {
    const payload = await this.#tokens.verify(requireToken(accessToken));
    return { userId: payload.sub, role: payload.role };
  }

  async getPreferencesSummary({ userId } = {}) {
    requireAuthenticatedUser(userId);
    const preference = await this.#loadPreference(userId);
    return toPreferencesSummaryDto(preference);
  }

  async updatePreferences({ userId, ...input } = {}) {
    requireAuthenticatedUser(userId);
    const preference = await this.#loadPreference(userId);

    // Solo los campos enviados; `undefined` no borra el valor guardado.
    const changes = Object.fromEntries(
      PREFERENCE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]]),
    );
    preference.update(changes); // valida >= 0 y minPrice <= maxPrice

    const saved = await this.#preferences.upsert(preference);
    return toPreferencesSummaryDto(saved);
  }

  async #loadPreference(userId) {
    return (await this.#preferences.findByUserId(userId)) ?? UserPreference.createDefault(userId);
  }

  async #openSession(user) {
    const signed = await this.#tokens.sign({ sub: user.id, role: user.role });
    return toAuthSessionDto(signed, user);
  }
}

function assertPasswordPolicy(password) {
  const { MIN_LENGTH, MAX_LENGTH } = PASSWORD_POLICY;
  const valid =
    typeof password === 'string' &&
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH &&
    /[A-Za-zÀ-ÿ]/.test(password) &&
    /\d/.test(password);
  if (!valid) {
    throw new ValidationError(
      `La contraseña debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres e incluir al menos una letra y un número.`,
      { field: 'password' },
    );
  }
}

function requireToken(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.trim() === '') {
    throw new UnauthorizedError();
  }
  return accessToken.trim();
}
