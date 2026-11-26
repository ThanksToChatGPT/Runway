import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';

/** `/api/auth` y `/api/preferences` → `AuthAndUserPort`. */
export function createAuthRoutes({ controller, authenticate, publicLimiter, loginLimiter }) {
  const auth = Router();
  auth.post('/register', publicLimiter, asyncHandler(controller.register));
  auth.post('/login', publicLimiter, loginLimiter, asyncHandler(controller.login));
  auth.post('/logout', authenticate, asyncHandler(controller.logout));

  const preferences = Router();
  preferences.use(authenticate);
  preferences.get('/', asyncHandler(controller.getPreferences));
  preferences.put('/', asyncHandler(controller.updatePreferences));

  return { auth, preferences };
}
