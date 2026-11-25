/**
 * Contratos Inbound (Casos de Uso) del MVP.
 * Documentan la firma esperada por los adaptadores HTTP.
 */

/**
 * @typedef {Object} AuthUseCase
 * @property {(input: {email: string, password: string, name: string}) => Promise<{token: string, user: Object}>} register
 * @property {(input: {email: string, password: string}) => Promise<{token: string, user: Object}>} login
 * @property {(userId: string) => Promise<Object>} getPreferences
 * @property {(userId: string, prefs: Object) => Promise<Object>} updatePreferences
 */

/**
 * @typedef {Object} CatalogUseCase
 * @property {(query: Object) => Promise<{items: Array, total: number, page: number, limit: number}>} searchProducts
 * @property {(id: string) => Promise<Object>} getProductById
 * @property {(ids: string[]) => Promise<Array>} compareProducts
 */

/**
 * @typedef {Object} OutfitUseCase
 * @property {(userId: string) => Promise<Array>} listUserOutfits
 * @property {(userId: string, payload: {name: string, topId?: string, bottomId?: string, shoesId?: string}) => Promise<Object>} saveOutfit
 * @property {(userId: string, outfitId: string) => Promise<void>} deleteOutfit
 */

/**
 * @typedef {Object} AdminUseCase
 * @property {() => Promise<Array>} listStores
 * @property {(input: {name: string, slug: string, base_url: string, is_active?: boolean}) => Promise<Object>} createStore
 * @property {(id: string, input: Object) => Promise<Object>} updateStore
 * @property {(id: string) => Promise<void>} deleteStore
 * @property {(storeId: string) => Promise<{storeId: string, importedCount: number}>} triggerScrape
 */
