import test from 'node:test';
import assert from 'node:assert/strict';

import { ValidationError } from '../../core/domain/index.js';
import { seedAdmin } from '../../seedAdmin.js';
import { FakePasswordHasher } from '../mocks/index.js';
import { FakePool, IDS } from './fakePg.js';

test('seedAdmin crea un administrador cuando el correo no existe', async () => {
  const pool = new FakePool([
    { match: /SELECT .* FROM users/, rows: [] },
    {
      match: /INSERT INTO users/,
      rows: [{
        id: IDS.user,
        email: 'admin@outfitbuilder.local',
        password_hash: 'hashed:Admin1234',
        auth_provider: 'local',
        name: 'Administrador',
        country: null,
        role: 'admin',
      }],
    },
  ]);

  const result = await seedAdmin({ pool, passwordHasher: new FakePasswordHasher(), env: {} });
  assert.deepEqual(result, { action: 'created', email: 'admin@outfitbuilder.local', id: IDS.user });
  assert.equal(pool.queries[1].params[5], 'admin');
});

test('seedAdmin promueve un usuario existente a admin y es idempotente si ya es admin', async () => {
  const userRow = {
    id: IDS.user,
    email: 'admin@demo.co',
    password_hash: 'hash',
    auth_provider: 'local',
    name: 'Admin',
    country: null,
    role: 'user',
  };

  const promotePool = new FakePool([
    { match: /SELECT .* FROM users/, rows: [userRow] },
    { match: /UPDATE users SET role/, rows: [] },
  ]);
  const promoted = await seedAdmin({
    pool: promotePool,
    passwordHasher: new FakePasswordHasher(),
    env: { ADMIN_EMAIL: 'Admin@Demo.co', ADMIN_PASSWORD: 'Secreta123' },
  });
  assert.deepEqual(promoted, { action: 'promoted', email: 'admin@demo.co', id: IDS.user });
  assert.deepEqual(promotePool.queries[1].params, ['admin', IDS.user]);

  const unchangedPool = new FakePool([{ match: /SELECT .* FROM users/, rows: [{ ...userRow, role: 'admin' }] }]);
  const unchanged = await seedAdmin({
    pool: unchangedPool,
    passwordHasher: new FakePasswordHasher(),
    env: { ADMIN_EMAIL: 'admin@demo.co', ADMIN_PASSWORD: 'Secreta123' },
  });
  assert.deepEqual(unchanged, { action: 'unchanged', email: 'admin@demo.co', id: IDS.user });
  assert.equal(unchangedPool.queries.length, 1);
});

test('seedAdmin exige ADMIN_PASSWORD en producción y valida la política de contraseña', async () => {
  const pool = new FakePool();
  await assert.rejects(
    seedAdmin({ pool, passwordHasher: new FakePasswordHasher(), env: { NODE_ENV: 'production' } }),
    ValidationError,
  );
  await assert.rejects(
    seedAdmin({ pool, passwordHasher: new FakePasswordHasher(), env: { ADMIN_PASSWORD: 'debil' } }),
    ValidationError,
  );
});
