import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../core/services/authService.js';

function createMockUserRepo() {
  const users = [];
  const prefs = new Map();
  return {
    async findByEmail(email) {
      return users.find((u) => u.email === email) || null;
    },
    async createUser({ email, password_hash, name, role }) {
      const user = {
        id: `user-${users.length + 1}`,
        email,
        password_hash,
        name,
        role,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      return user;
    },
    async getPreferences(userId) {
      return prefs.get(userId) || null;
    },
    async upsertPreferences(userId, data) {
      const record = { user_id: userId, ...data };
      prefs.set(userId, record);
      return record;
    },
  };
}

test('authService registra usuario y permite login con JWT', async () => {
  const userRepo = createMockUserRepo();
  const authService = createAuthService({ userRepo, jwtSecret: 'test_secret' });

  const reg = await authService.register({
    email: 'test@example.com',
    password: 'password123',
    name: 'Camila',
  });
  assert.ok(reg.token);
  assert.equal(reg.user.email, 'test@example.com');

  const login = await authService.login({
    email: 'test@example.com',
    password: 'password123',
  });
  assert.ok(login.token);
  assert.equal(login.user.name, 'Camila');
});

test('authService rechaza contraseña incorrecta', async () => {
  const userRepo = createMockUserRepo();
  const authService = createAuthService({ userRepo, jwtSecret: 'test_secret' });

  await authService.register({
    email: 'user@example.com',
    password: 'password123',
    name: 'Juan',
  });

  await assert.rejects(
    () => authService.login({ email: 'user@example.com', password: 'wrong' }),
    /Credenciales inválidas/
  );
});
