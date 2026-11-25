export function createOutfitRepository(pool) {
  return {
    async findByUserId(userId) {
      const { rows } = await pool.query(
        `SELECT o.id, o.name, o.total_cop, o.created_at,
                COALESCE(
                  (SELECT json_agg(
                    json_build_object(
                      'slot_type', os.slot_type,
                      'product_id', p.id,
                      'title', p.title,
                      'brand', p.brand,
                      'price_cop', p.price_cop,
                      'product_url', p.product_url,
                      'store_name', s.name,
                      'image_url', (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1)
                    )
                  )
                  FROM outfit_slots os
                  JOIN products p ON p.id = os.product_id
                  JOIN stores s ON s.id = p.store_id
                  WHERE os.outfit_id = o.id),
                  '[]'::json
                ) AS slots
         FROM outfits o
         WHERE o.user_id = $1
         ORDER BY o.created_at DESC`,
        [userId]
      );
      return rows;
    },

    async createOutfit({ userId, name, totalCop, slots }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO outfits (user_id, name, total_cop)
           VALUES ($1, $2, $3)
           RETURNING id, user_id, name, total_cop, created_at`,
          [userId, name, totalCop]
        );
        const outfit = rows[0];

        for (const slot of slots) {
          await client.query(
            `INSERT INTO outfit_slots (outfit_id, product_id, slot_type)
             VALUES ($1, $2, $3)`,
            [outfit.id, slot.product_id, slot.slot_type]
          );
        }

        await client.query('COMMIT');
        return { ...outfit, slots };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async deleteOutfit(userId, outfitId) {
      const { rowCount } = await pool.query(
        'DELETE FROM outfits WHERE id = $1 AND user_id = $2',
        [outfitId, userId]
      );
      return rowCount > 0;
    },
  };
}
