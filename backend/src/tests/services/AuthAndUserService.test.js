import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthAndUserService } from '../../core/services/index.js';
import { AuthAndUserPort, assertImplements } from '../../core/ports/index.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../../core/domain/errors.js';
import {
  FakePasswordHasher,
  FakeTokenService,
  InMemoryPreferenceRepository,
  InMemoryUserRepository,
  buildPreference,
} from '../mocks/index.js';

const VALID = { email: 'Ana@Correo.com ', password: 'clave1234', name: 'Ana' };

function setup() {
  const deps = {
    userRepository: new InMemoryUserRepository(),
    preferenceRepository: new InMemoryPreferenceRepository(),
    passwordHasher: new FakePasswordHasher(),
    tokenService: new FakeTokenService(),
  };
  return { ...deps, service: new AuthAndUserService(deps) };
}

test('implementa todos los métodos de AuthAndUserPort', () => {
  assert.doesNotThrow(() => assertImplements(setup().service, AuthAndUserPort));
});

test('register guarda un usuario normal con la contraseña hasheada y abre sesión sin exponer el hash', async () => {
  const { service, userRepository } = setup();
  const session = await service.register(VALID);

  assert.equal(session.tokenType, 'Bearer');
  assert.equal(session.accessToken, 'token-1');
  assert.deepEqual(session.user, { id: 'user-1', email: 'ana@correo.com', name: 'Ana', country: null, role: 'user' });
  assert.ok(!JSON.stringify(session).includes('hashed'));

  const stored = await userRepository.findByEmail('ana@correo.com');
  assert.equal(stored.passwordHash, 'hashed:clave1234');
  assert.equal(stored.role, 'user');
});

test('register ignora un rol enviado por el cliente', async () => {
  const { service } = setup();
  const session = await service.register({ ...VALID, role: 'admin' });
  assert.equal(session.user.role, 'user');
});

test('register rechaza un correo ya registrado (sin importar mayúsculas)', async () => {
  const { service, userRepository } = setup();
  await service.register(VALID);
  await assert.rejects(
    service.register({ ...VALID, email: 'ANA@correo.com' }),
    (error) => error instanceof ConflictError && /Ya existe una cuenta/.test(error.message),
  );
  assert.equal(userRepository.size, 1);
});

test('register exige una contraseña con la política mínima', async () => {
  const { service, userRepository } = setup();
  for (const password of ['corta1', 'sinnumeros', '12345678', undefined]) {
    await assert.rejects(service.register({ ...VALID, password }), ValidationError);
  }
  assert.equal(userRepository.size, 0);
});

test('register valida el formato del correo', async () => {
  const { service } = setup();
  await assert.rejects(service.register({ ...VALID, email: 'no-es-correo' }), ValidationError);
});

test('login exitoso emite un token para el usuario', async () => {
  const { service } = setup();
  await service.register(VALID);
  const session = await service.login({ email: 'ana@correo.com', password: 'clave1234' });
  assert.equal(session.user.email, 'ana@correo.com');
  assert.ok(session.accessToken);
});

test('login fallido responde el mismo mensaje para correo inexistente y contraseña errónea', async () => {
  const { service } = setup();
  await service.register(VALID);

  const errors = [];
  for (const input of [
    { email: 'ana@correo.com', password: 'otraClave9' },
    { email: 'nadie@correo.com', password: 'clave1234' },
    { email: 'formato-malo', password: 'clave1234' },
    { email: 'ana@correo.com', password: '' },
  ]) {
    await assert.rejects(service.login(input), (error) => {
      errors.push(error);
      return error instanceof UnauthorizedError;
    });
  }
  assert.equal(new Set(errors.map((e) => e.message)).size, 1);
  assert.match(errors[0].message, /correo o la contraseña no son correctos/);
});

test('logout revoca el token: verifySession deja de aceptarlo', async () => {
  const { service, tokenService } = setup();
  const { accessToken } = await service.register(VALID);

  assert.deepEqual(await service.verifySession({ accessToken }), { userId: 'user-1', role: 'user' });
  await service.logout({ accessToken });
  assert.ok(tokenService.isRevoked(accessToken));
  await assert.rejects(service.verifySession({ accessToken }), UnauthorizedError);
  await assert.doesNotReject(service.logout({ accessToken }), 'logout es idempotente');
});

test('logout y verifySession sin token piden iniciar sesión', async () => {
  const { service } = setup();
  await assert.rejects(service.logout({}), UnauthorizedError);
  await assert.rejects(service.verifySession({ accessToken: '  ' }), UnauthorizedError);
});

test('getPreferencesSummary devuelve valores por defecto si no hay preferencias', async () => {
  const { service } = setup();
  const summary = await service.getPreferencesSummary({ userId: 'user-1' });
  assert.deepEqual(summary, {
    userId: 'user-1',
    priceRange: { min: null, max: null },
    maxOutfitBudget: null,
    hasPriceRange: false,
    hasBudget: false,
    currency: 'COP',
  });
});

test('updatePreferences guarda rango y presupuesto en COP', async () => {
  const { service, preferenceRepository } = setup();
  const summary = await service.updatePreferences({
    userId: 'user-1',
    minPrice: 50000,
    maxPrice: 200000,
    maxOutfitBudget: 400000,
  });
  assert.deepEqual(summary.priceRange, { min: 50000, max: 200000 });
  assert.equal(summary.maxOutfitBudget, 400000);
  assert.equal((await preferenceRepository.findByUserId('user-1')).maxOutfitBudget, 400000);
});

test('updatePreferences solo cambia los campos enviados y null borra el valor', async () => {
  const { service, preferenceRepository } = setup();
  await preferenceRepository.upsert(buildPreference('user-1', { minPrice: 10000, maxPrice: 90000, maxOutfitBudget: 300000 }));

  let summary = await service.updatePreferences({ userId: 'user-1', maxOutfitBudget: 350000 });
  assert.deepEqual(summary.priceRange, { min: 10000, max: 90000 });
  assert.equal(summary.maxOutfitBudget, 350000);

  summary = await service.updatePreferences({ userId: 'user-1', maxOutfitBudget: null });
  assert.equal(summary.hasBudget, false);
});

test('updatePreferences rechaza mínimo > máximo y presupuesto negativo sin guardar nada', async () => {
  const { service, preferenceRepository } = setup();
  await assert.rejects(
    service.updatePreferences({ userId: 'user-1', minPrice: 300000, maxPrice: 100000 }),
    (error) => error instanceof ValidationError && /mínimo no puede ser mayor/.test(error.message),
  );
  await assert.rejects(service.updatePreferences({ userId: 'user-1', maxOutfitBudget: -1 }), ValidationError);
  assert.equal(await preferenceRepository.findByUserId('user-1'), null);
});

test('las preferencias exigen un usuario autenticado', async () => {
  const { service } = setup();
  await assert.rejects(service.getPreferencesSummary({}), UnauthorizedError);
  await assert.rejects(service.updatePreferences({ minPrice: 1 }), UnauthorizedError);
});
