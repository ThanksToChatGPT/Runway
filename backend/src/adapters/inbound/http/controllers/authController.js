/**
 * Adapter (driving): HTTP ↔ `AuthAndUserPort`.
 * Solo traduce la petición a la entrada del puerto y la salida a JSON.
 *
 * @param {import('../../../../core/ports/inbound/AuthAndUserPort.js').AuthAndUserPort} authService
 */
export function createAuthController(authService) {
  return {
    async register(req, res) {
      const { email, password, name, country } = req.body ?? {};
      const session = await authService.register({ email, password, name, country });
      res.status(201).json(session);
    },

    async login(req, res) {
      const { email, password } = req.body ?? {};
      const session = await authService.login({ email, password });
      res.status(200).json(session);
    },

    async logout(req, res) {
      await authService.logout({ accessToken: req.accessToken });
      res.status(204).end();
    },

    async getPreferences(req, res) {
      const summary = await authService.getPreferencesSummary({ userId: req.user.id });
      res.status(200).json(summary);
    },

    async updatePreferences(req, res) {
      // Solo se envían al core los campos presentes; `null` borra el valor.
      const { minPrice, maxPrice, maxOutfitBudget } = req.body ?? {};
      const summary = await authService.updatePreferences({
        userId: req.user.id,
        minPrice,
        maxPrice,
        maxOutfitBudget,
      });
      res.status(200).json(summary);
    },
  };
}
