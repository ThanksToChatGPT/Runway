import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../domain/errors.js';
import { validateLoginInput, validateRegisterInput } from '../domain/user.js';
import { validatePricePreferences } from '../domain/preferences.js';

export function createAuthService({ userRepo, jwtSecret }) {
  function signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );
  }

  function sanitizeUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    };
  }

  return {
    async register(input) {
      let valid;
      try {
        valid = validateRegisterInput(input);
      } catch (err) {
        throw new AppError(err.message, 400);
      }

      const existing = await userRepo.findByEmail(valid.email);
      if (existing) {
        throw new AppError('El correo ya está registrado', 409);
      }

      const password_hash = await bcrypt.hash(valid.password, 10);
      const user = await userRepo.createUser({
        email: valid.email,
        password_hash,
        name: valid.name,
        role: 'user',
      });

      await userRepo.upsertPreferences(user.id, {
        min_price_cop: 0,
        max_price_cop: 500000,
        budget_limit_cop: 500000,
      });

      return {
        token: signToken(user),
        user: sanitizeUser(user),
      };
    },

    async login(input) {
      let valid;
      try {
        valid = validateLoginInput(input);
      } catch (err) {
        throw new AppError(err.message, 400);
      }

      const user = await userRepo.findByEmail(valid.email);
      if (!user) {
        throw new AppError('Credenciales inválidas', 401);
      }

      const ok = await bcrypt.compare(valid.password, user.password_hash);
      if (!ok) {
        throw new AppError('Credenciales inválidas', 401);
      }

      return {
        token: signToken(user),
        user: sanitizeUser(user),
      };
    },

    async getPreferences(userId) {
      const prefs = await userRepo.getPreferences(userId);
      if (!prefs) {
        return {
          user_id: userId,
          min_price_cop: 0,
          max_price_cop: 500000,
          budget_limit_cop: 500000,
        };
      }
      return prefs;
    },

    async updatePreferences(userId, input) {
      let valid;
      try {
        valid = validatePricePreferences(input);
      } catch (err) {
        throw new AppError(err.message, 400);
      }
      return userRepo.upsertPreferences(userId, valid);
    },
  };
}
