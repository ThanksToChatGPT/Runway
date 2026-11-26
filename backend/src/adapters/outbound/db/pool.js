import pg from 'pg';

const { Pool } = pg;

/**
 * Connection Pool (Singleton): un único pool de PostgreSQL para todo el proceso.
 *
 * Variables de entorno:
 * - DATABASE_URL           cadena de conexión (si falta, `pg` usa PGHOST, PGUSER, PGPASSWORD…).
 * - DB_POOL_MAX            conexiones máximas (por defecto 10).
 * - DB_IDLE_TIMEOUT_MS     cierre de conexiones inactivas (por defecto 30000).
 * - DB_CONNECTION_TIMEOUT_MS espera máxima para obtener una conexión (por defecto 5000).
 * - DB_STATEMENT_TIMEOUT_MS  corta consultas colgadas (por defecto 10000).
 * - DB_SSL                 'true' para conectar con TLS (bases de datos gestionadas).
 */

let instance = null;

function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Lee la configuración del pool desde las variables de entorno. */
export function poolConfigFromEnv() {
  return {
    connectionString: process.env.DATABASE_URL || undefined,
    max: intFromEnv('DB_POOL_MAX', 10),
    idleTimeoutMillis: intFromEnv('DB_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: intFromEnv('DB_CONNECTION_TIMEOUT_MS', 5_000),
    statement_timeout: intFromEnv('DB_STATEMENT_TIMEOUT_MS', 10_000),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  };
}

/**
 * Devuelve el pool compartido; lo crea en la primera llamada.
 * @returns {import('pg').Pool}
 */
export function getPool() {
  if (!instance) {
    instance = new Pool(poolConfigFromEnv());
    // Un cliente inactivo que falla no debe tumbar el proceso: `pg` lo descarta y crea otro.
    instance.on('error', (error) => {
      console.error('[db] Error en una conexión inactiva del pool:', error.message);
    });
  }
  return instance;
}

/** Cierra el pool (apagado ordenado del servidor y tests). */
export async function closePool() {
  if (!instance) return;
  const pool = instance;
  instance = null;
  await pool.end();
}

/**
 * @deprecated Usado solo por el prototipo anterior (`src/index.js`).
 * Los adaptadores nuevos usan `getPool()`.
 */
export function createPool(connectionString) {
  return new Pool({ connectionString });
}
