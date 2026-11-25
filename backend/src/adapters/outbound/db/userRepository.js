export function createUserRepository(pool) {
  return {
    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1',
        [email]
      );
      return rows[0] || null;
    },

    async findById(id) {
      const { rows } = await pool.query(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
        [id]
      );
      return rows[0] || null;
    },

    async createUser({ email, password_hash, name, role = 'user' }) {
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role, created_at`,
        [email, password_hash, name, role]
      );
      return rows[0];
    },

    async getPreferences(userId) {
      const { rows } = await pool.query(
        `SELECT id, user_id, min_price_cop, max_price_cop, budget_limit_cop, updated_at
         FROM user_preferences
         WHERE user_id = $1`,
        [userId]
      );
      return rows[0] || null;
    },

    async upsertPreferences(userId, { min_price_cop, max_price_cop, budget_limit_cop }) {
      const { rows } = await pool.query(
        `INSERT INTO user_preferences (user_id, min_price_cop, max_price_cop, budget_limit_cop, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           min_price_cop = EXCLUDED.min_price_cop,
           max_price_cop = EXCLUDED.max_price_cop,
           budget_limit_cop = EXCLUDED.budget_limit_cop,
           updated_at = NOW()
         RETURNING id, user_id, min_price_cop, max_price_cop, budget_limit_cop, updated_at`,
        [userId, min_price_cop, max_price_cop, budget_limit_cop]
      );
      return rows[0];
    },
  };
}
