export function createStoreRepository(pool) {
  return {
    async findAll() {
      const { rows } = await pool.query(
        'SELECT id, name, slug, base_url, is_active, created_at FROM stores ORDER BY created_at DESC'
      );
      return rows;
    },

    async findById(id) {
      const { rows } = await pool.query(
        'SELECT id, name, slug, base_url, is_active, created_at FROM stores WHERE id = $1',
        [id]
      );
      return rows[0] || null;
    },

    async create({ name, slug, base_url, is_active = true }) {
      const { rows } = await pool.query(
        `INSERT INTO stores (name, slug, base_url, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, slug, base_url, is_active, created_at`,
        [name, slug, base_url, is_active]
      );
      return rows[0];
    },

    async update(id, data) {
      const { rows } = await pool.query(
        `UPDATE stores
         SET name = COALESCE($2, name),
             slug = COALESCE($3, slug),
             base_url = COALESCE($4, base_url),
             is_active = COALESCE($5, is_active)
         WHERE id = $1
         RETURNING id, name, slug, base_url, is_active, created_at`,
        [
          id,
          data.name ?? null,
          data.slug ?? null,
          data.base_url ?? null,
          data.is_active !== undefined ? Boolean(data.is_active) : null,
        ]
      );
      return rows[0] || null;
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM stores WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}
