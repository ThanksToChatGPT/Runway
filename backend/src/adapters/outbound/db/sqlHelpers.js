/**
 * Utilidades SQL compartidas por los repositorios PostgreSQL.
 * Ninguna arma SQL con valores del usuario: los valores siempre viajan como parámetros ($1, $2…).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Código de PostgreSQL para violación de restricción UNIQUE. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Las columnas son UUID: un id con otro formato no puede existir.
 * Filtrarlo antes evita que PostgreSQL lance `invalid input syntax for type uuid`.
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/** Escapa los comodines de LIKE (`%`, `_`, `\`) para buscar el texto literal. */
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Ejecuta `work(client)` dentro de una transacción con un cliente dedicado del pool.
 * Hace ROLLBACK ante cualquier error y siempre devuelve el cliente al pool.
 * @template T
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
