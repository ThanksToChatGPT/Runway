import type {
  AuthSession,
  CatalogFacets,
  Category,
  Outfit,
  OutfitPieces,
  PreferencesSummary,
  PriceSort,
  ProductComparison,
  ProductDetail,
  ProductPage,
  ScrapingResult,
  Store,
  StoreRef,
  UpdatePreferencesRequest,
  User,
} from '@/types';
import { formatCOP } from '@/domain/money';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'ob_token';
const USER_KEY = 'ob_user';

export class ApiError extends Error {
  status: number;
  field?: string;

  constructor(message: string, status: number, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

export function formatCop(value: number): string {
  return formatCOP(value);
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthSession(accessToken: string, user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'No fue posible conectar con el servidor. Verifica que la API esté activa.',
      0,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    field?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      data.error || `Error HTTP ${res.status}`,
      res.status,
      data.field,
    );
  }
  return data as T;
}

export interface SearchProductsParams {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string[];
  color?: string[];
  size?: string[];
  category?: Category;
  subcategory?: string;
  store?: string[];
  excludeStore?: string[];
  sort?: PriceSort;
  page?: number;
  pageSize?: number;
  usePreferences?: boolean;
}

function buildSearchQuery(params: SearchProductsParams): string {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.minPrice !== undefined) qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice));
  if (params.brand?.length) qs.set('brand', params.brand.join(','));
  if (params.color?.length) qs.set('color', params.color.join(','));
  if (params.size?.length) qs.set('size', params.size.join(','));
  if (params.category) qs.set('category', params.category);
  if (params.subcategory) qs.set('subcategory', params.subcategory);
  if (params.store?.length) qs.set('store', params.store.join(','));
  if (params.excludeStore?.length)
    qs.set('excludeStore', params.excludeStore.join(','));
  if (params.sort) qs.set('sort', params.sort);
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.pageSize !== undefined)
    qs.set('pageSize', String(params.pageSize));
  if (params.usePreferences) qs.set('usePreferences', 'true');
  return qs.toString();
}

export const api = {
  // Autenticación
  register: (payload: {
    email: string;
    password: string;
    name: string;
    country?: string | null;
  }) =>
    request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
    }),

  // Preferencias
  getPreferences: () => request<PreferencesSummary>('/preferences'),

  updatePreferences: (payload: UpdatePreferencesRequest) =>
    request<PreferencesSummary>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Catálogo
  getStores: () => request<{ items: StoreRef[] }>('/stores'),

  getFacets: () => request<CatalogFacets>('/products/facets'),

  searchProducts: (params: SearchProductsParams = {}) => {
    const query = buildSearchQuery(params);
    return request<ProductPage>(`/products${query ? `?${query}` : ''}`);
  },

  getProduct: (id: string) => request<ProductDetail>(`/products/${id}`),

  compareProducts: (ids: string[]) =>
    request<ProductComparison>(`/products/compare?ids=${ids.join(',')}`),

  // Outfits
  startDraftOutfit: (name?: string) =>
    request<Outfit>('/outfits/draft', {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    }),

  assignDraftPiece: (payload: {
    draft?: { name?: string; pieces?: OutfitPieces };
    slotType: Category;
    productId: string;
  }) =>
    request<Outfit>('/outfits/draft/pieces', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOutfits: () => request<{ items: Outfit[] }>('/outfits'),

  getOutfitById: (id: string) => request<Outfit>(`/outfits/${id}`),

  saveOutfit: (payload: { name: string; pieces: OutfitPieces }) =>
    request<Outfit>('/outfits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin - Tiendas
  adminListStores: () => request<{ items: Store[] }>('/admin/stores'),

  adminCreateStore: (payload: {
    name: string;
    baseUrl: string;
    isActive?: boolean;
  }) =>
    request<Store>('/admin/stores', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateStore: (
    id: string,
    payload: { name?: string; baseUrl?: string },
  ) =>
    request<Store>(`/admin/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  adminSetStoreStatus: (id: string, isActive: boolean) =>
    request<Store>(`/admin/stores/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  adminTriggerScrape: (id: string) =>
    request<ScrapingResult>(`/admin/stores/${id}/scrape`, {
      method: 'POST',
    }),
};
