/**
 * Doble mínimo de `pg.Pool` / `pg.PoolClient`: registra cada consulta (SQL +
 * parámetros) y responde con la primera regla cuyo patrón coincida con el SQL.
 */
export class FakePool {
  /** @type {{ sql: string, params: unknown[] }[]} */
  queries = [];
  released = 0;

  /** @param {{ match: RegExp, rows?: object[], error?: Error }[]} rules */
  constructor(rules = []) {
    this.rules = rules;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    const rule = this.rules.find((r) => r.match.test(sql));
    if (rule?.error) throw rule.error;
    return { rows: typeof rule?.rows === 'function' ? rule.rows(params) : rule?.rows ?? [] };
  }

  async connect() {
    return { query: (sql, params) => this.query(sql, params), release: () => { this.released += 1; } };
  }

  sqlLog() {
    return this.queries.map((q) => q.sql.replace(/\s+/g, ' ').trim());
  }
}

export const IDS = Object.freeze({
  user: '11111111-1111-4111-8111-111111111111',
  otherUser: '22222222-2222-4222-8222-222222222222',
  store: '33333333-3333-4333-8333-333333333333',
  top: '44444444-4444-4444-8444-444444444444',
  shoes: '55555555-5555-4555-8555-555555555555',
  outfit: '66666666-6666-4666-8666-666666666666',
});

export function productRow(overrides = {}) {
  return {
    id: IDS.top,
    store_id: IDS.store,
    name: 'Camiseta básica',
    brand: 'UrbanCO',
    category: 'top',
    subcategory: 't-shirt',
    material: null,
    color: 'black',
    price_cop: '89900.00',
    rating: '4.50',
    is_second_hand: false,
    external_url: 'https://tienda.example/camiseta',
    last_price_update: new Date('2026-11-01T00:00:00Z'),
    is_hidden: false,
    ...overrides,
  };
}
