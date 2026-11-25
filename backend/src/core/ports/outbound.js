/**
 * Contratos Outbound (Repositorios y Gateways externos).
 */

/**
 * @typedef {Object} UserRepository
 * @property {(email: string) => Promise<Object|null>} findByEmail
 * @property {(id: string) => Promise<Object|null>} findById
 * @property {(data: {email: string, password_hash: string, name: string, role?: string}) => Promise<Object>} createUser
 * @property {(userId: string) => Promise<Object|null>} getPreferences
 * @property {(userId: string, prefs: {min_price_cop: number, max_price_cop: number, budget_limit_cop: number}) => Promise<Object>} upsertPreferences
 */

/**
 * @typedef {Object} ProductRepository
 * @property {(filters: Object) => Promise<{items: Array, total: number, page: number, limit: number}>} search
 * @property {(id: string) => Promise<Object|null>} findById
 * @property {(ids: string[]) => Promise<Array>} findByIds
 * @property {(storeId: string, products: Array) => Promise<number>} upsertScrapedProducts
 */

/**
 * @typedef {Object} OutfitRepository
 * @property {(userId: string) => Promise<Array>} findByUserId
 * @property {(data: {userId: string, name: string, totalCop: number, slots: Array<{slot_type: string, product_id: string}>}) => Promise<Object>} createOutfit
 * @property {(userId: string, outfitId: string) => Promise<boolean>} deleteOutfit
 */

/**
 * @typedef {Object} StoreRepository
 * @property {() => Promise<Array>} findAll
 * @property {(id: string) => Promise<Object|null>} findById
 * @property {(data: {name: string, slug: string, base_url: string, is_active: boolean}) => Promise<Object>} create
 * @property {(id: string, data: Object) => Promise<Object|null>} update
 * @property {(id: string) => Promise<boolean>} remove
 */

/**
 * @typedef {Object} ScraperGateway
 * @property {(store: {id: string, slug: string, base_url: string}) => Promise<Array>} scrapeStore
 */
