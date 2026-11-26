import { UserRepository } from '../../../core/ports/index.js';
import { ConflictError } from '../../../core/domain/index.js';
import { getPool } from './pool.js';
import { toUser } from './mappers.js';
import { isUuid, PG_UNIQUE_VIOLATION } from './sqlHelpers.js';

const COLUMNS = 'id, email, password_hash, auth_provider, name, country, role';

/** Adapter: `UserRepository` sobre la tabla `users`. */
export class PgUserRepository extends UserRepository {
  #db;

  /** @param {{ pool?: import('pg').Pool }} [deps] */
  constructor({ pool } = {}) {
    super();
    this.#db = pool ?? getPool();
  }

  async findByEmail(email) {
    const { rows } = await this.#db.query(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return toUser(rows[0]);
  }

  async findById(id) {
    if (!isUuid(id)) return null;
    const { rows } = await this.#db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return toUser(rows[0]);
  }

  async create(user) {
    try {
      const { rows } = await this.#db.query(
        `INSERT INTO users (email, password_hash, auth_provider, name, country, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [user.email, user.passwordHash, user.authProvider, user.name, user.country, user.role],
      );
      return toUser(rows[0]);
    } catch (error) {
      // Carrera entre dos registros con el mismo correo: la restricción UNIQUE decide.
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictError('Ya existe una cuenta con este correo.', { field: 'email' });
      }
      throw error;
    }
  }
}
