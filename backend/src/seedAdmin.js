/**
 * Script idempotente para crear o promover un usuario administrador en local o Docker.
 *
 * Variables de entorno (opcionales en desarrollo; `ADMIN_PASSWORD` es obligatoria si `NODE_ENV=production`):
 * - ADMIN_EMAIL    (por defecto: admin@outfitbuilder.local)
 * - ADMIN_PASSWORD (por defecto: Admin1234; 8-72 caracteres con al menos una letra y un número)
 * - ADMIN_NAME     (por defecto: Administrador)
 */
import { pathToFileURL } from 'node:url';

import { ROLES, User, ValidationError } from './core/domain/index.js';
import { PASSWORD_POLICY } from './core/services/index.js';
import { BcryptPasswordHasher, PgUserRepository, closePool, getPool } from './adapters/outbound/index.js';

const DEV_DEFAULTS = Object.freeze({
  email: 'admin@outfitbuilder.local',
  password: 'Admin1234',
  name: 'Administrador',
});

function validatePassword(password) {
  const { MIN_LENGTH, MAX_LENGTH } = PASSWORD_POLICY;
  const valid =
    typeof password === 'string' &&
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH &&
    /[A-Za-zÀ-ÿ]/.test(password) &&
    /\d/.test(password);
  if (!valid) {
    throw new ValidationError(
      `ADMIN_PASSWORD debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres e incluir al menos una letra y un número.`,
      { field: 'password' },
    );
  }
}

export async function seedAdmin({
  pool = getPool(),
  passwordHasher = BcryptPasswordHasher.fromEnv(),
  env = process.env,
} = {}) {
  if (env.NODE_ENV === 'production' && !env.ADMIN_PASSWORD) {
    throw new ValidationError('Define ADMIN_PASSWORD explícitamente en producción.', { field: 'password' });
  }

  const email = User.normalizeEmail(env.ADMIN_EMAIL || DEV_DEFAULTS.email);
  const name = (env.ADMIN_NAME || DEV_DEFAULTS.name).trim();
  const password = env.ADMIN_PASSWORD || DEV_DEFAULTS.password;
  validatePassword(password);

  const userRepository = new PgUserRepository({ pool });
  const existing = await userRepository.findByEmail(email);

  if (existing) {
    if (existing.role === ROLES.ADMIN) {
      return { action: 'unchanged', email: existing.email, id: existing.id };
    }
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [ROLES.ADMIN, existing.id]);
    return { action: 'promoted', email: existing.email, id: existing.id };
  }

  const passwordHash = await passwordHasher.hash(password);
  const created = await userRepository.create(new User({ email, passwordHash, name, role: ROLES.ADMIN }));
  return { action: 'created', email: created.email, id: created.id };
}

async function main() {
  try {
    const result = await seedAdmin();
    if (result.action === 'created') {
      console.log(`[seed:admin] Administrador creado: ${result.email} (${result.id})`);
    } else if (result.action === 'promoted') {
      console.log(`[seed:admin] Usuario promovido a admin: ${result.email} (${result.id})`);
    } else {
      console.log(`[seed:admin] El usuario ${result.email} ya es administrador.`);
    }
  } catch (error) {
    console.error('[seed:admin] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
