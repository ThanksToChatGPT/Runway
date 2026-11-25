export function createProductRepository(pool) {
  return {
    async search(filters) {
      const conditions = [];
      const params = [];

      if (filters.q) {
        params.push(`%${filters.q}%`);
        conditions.push(`(p.title ILIKE $${params.length} OR p.brand ILIKE $${params.length})`);
      }
      if (filters.category) {
        params.push(filters.category);
        conditions.push(`p.category = $${params.length}`);
      }
      if (filters.brand) {
        params.push(`%${filters.brand}%`);
        conditions.push(`p.brand ILIKE $${params.length}`);
      }
      if (filters.color) {
        params.push(`%${filters.color}%`);
        conditions.push(`p.color ILIKE $${params.length}`);
      }
      if (filters.storeId) {
        params.push(filters.storeId);
        conditions.push(`p.store_id = $${params.length}`);
      }
      if (Number.isFinite(filters.minPrice)) {
        params.push(filters.minPrice);
        conditions.push(`p.price_cop >= $${params.length}`);
      }
      if (Number.isFinite(filters.maxPrice)) {
        params.push(filters.maxPrice);
        conditions.push(`p.price_cop <= $${params.length}`);
      }
      if (filters.size) {
        params.push(filters.size);
        conditions.push(
          `EXISTS (SELECT 1 FROM product_size_stocks pss WHERE pss.product_id = p.id AND pss.size = $${params.length} AND pss.in_stock = TRUE)`
        );
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let orderBy = 'p.created_at DESC';
      if (filters.sort === 'price_asc') orderBy = 'p.price_cop ASC';
      if (filters.sort === 'price_desc') orderBy = 'p.price_cop DESC';

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM products p ${whereClause}`,
        params
      );
      const total = countRes.rows[0]?.total || 0;

      const offset = (filters.page - 1) * filters.limit;
      const listParams = [...params, filters.limit, offset];

      const { rows } = await pool.query(
        `SELECT p.id, p.store_id, s.name AS store_name, p.external_id, p.title, p.brand,
                p.category, p.color, p.price_cop, p.product_url, p.created_at,
                COALESCE(
                  (SELECT json_agg(json_build_object('image_url', pi.image_url, 'is_primary', pi.is_primary) ORDER BY pi.sort_order)
                   FROM product_images pi WHERE pi.product_id = p.id),
                  '[]'::json
                ) AS images,
                COALESCE(
                  (SELECT json_agg(json_build_object('size', pss.size, 'in_stock', pss.in_stock))
                   FROM product_size_stocks pss WHERE pss.product_id = p.id),
                  '[]'::json
                ) AS sizes
         FROM products p
         JOIN stores s ON s.id = p.store_id
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );

      return {
        items: rows,
        total,
        page: filters.page,
        limit: filters.limit,
      };
    },

    async findById(id) {
      const { rows } = await pool.query(
        `SELECT p.id, p.store_id, s.name AS store_name, s.base_url AS store_url,
                p.external_id, p.title, p.brand, p.category, p.color, p.price_cop, p.product_url, p.created_at,
                COALESCE(
                  (SELECT json_agg(json_build_object('image_url', pi.image_url, 'is_primary', pi.is_primary) ORDER BY pi.sort_order)
                   FROM product_images pi WHERE pi.product_id = p.id),
                  '[]'::json
                ) AS images,
                COALESCE(
                  (SELECT json_agg(json_build_object('size', pss.size, 'in_stock', pss.in_stock))
                   FROM product_size_stocks pss WHERE pss.product_id = p.id),
                  '[]'::json
                ) AS sizes
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE p.id = $1`,
        [id]
      );
      return rows[0] || null;
    },

    async findByIds(ids) {
      if (!ids || ids.length === 0) return [];
      const { rows } = await pool.query(
        `SELECT p.id, p.store_id, s.name AS store_name, p.external_id, p.title, p.brand,
                p.category, p.color, p.price_cop, p.product_url,
                COALESCE(
                  (SELECT json_agg(json_build_object('image_url', pi.image_url, 'is_primary', pi.is_primary) ORDER BY pi.sort_order)
                   FROM product_images pi WHERE pi.product_id = p.id),
                  '[]'::json
                ) AS images,
                COALESCE(
                  (SELECT json_agg(json_build_object('size', pss.size, 'in_stock', pss.in_stock))
                   FROM product_size_stocks pss WHERE pss.product_id = p.id),
                  '[]'::json
                ) AS sizes
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE p.id = ANY($1::uuid[])`,
        [ids]
      );
      return rows;
    },

    async upsertScrapedProducts(storeId, products) {
      const client = await pool.connect();
      let count = 0;
      try {
        await client.query('BEGIN');
        for (const item of products) {
          const { rows } = await client.query(
            `INSERT INTO products (store_id, external_id, title, brand, category, color, price_cop, product_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (store_id, external_id)
             DO UPDATE SET
               title = EXCLUDED.title,
               brand = EXCLUDED.brand,
               category = EXCLUDED.category,
               color = EXCLUDED.color,
               price_cop = EXCLUDED.price_cop,
               product_url = EXCLUDED.product_url
             RETURNING id`,
            [
              storeId,
              item.external_id,
              item.title,
              item.brand,
              item.category,
              item.color,
              item.price_cop,
              item.product_url,
            ]
          );

          const productId = rows[0].id;

          await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
          const images = Array.isArray(item.images) ? item.images : [];
          for (let idx = 0; idx < images.length; idx++) {
            await client.query(
              `INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [productId, images[idx], idx === 0, idx]
            );
          }

          await client.query('DELETE FROM product_size_stocks WHERE product_id = $1', [productId]);
          const sizes = Array.isArray(item.sizes) ? item.sizes : [];
          for (const sz of sizes) {
            await client.query(
              `INSERT INTO product_size_stocks (product_id, size, in_stock)
               VALUES ($1, $2, $3)
               ON CONFLICT (product_id, size) DO UPDATE SET in_stock = EXCLUDED.in_stock`,
              [productId, sz.size || sz, sz.in_stock !== undefined ? Boolean(sz.in_stock) : true]
            );
          }

          count++;
        }
        await client.query('COMMIT');
        return count;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
