import type {
  Outfit,
  Product,
  ProductSearchResponse,
  Store,
  User,
  UserPreferences,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ob_token');
}

export function setAuthSession(token: string, user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ob_token', token);
  localStorage.setItem('ob_user', JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('ob_token');
  localStorage.removeItem('ob_user');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ob_user');
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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; name: string }) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Preferences
  getPreferences: () => request<UserPreferences>('/preferences'),
  updatePreferences: (payload: UserPreferences) =>
    request<UserPreferences>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Catalog
  getStores: () => request<Store[]>('/stores'),
  searchProducts: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<ProductSearchResponse>(`/products?${qs.toString()}`);
  },
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  compareProducts: (ids: string[]) =>
    request<{ items: Product[] }>(`/products/compare?ids=${ids.join(',')}`),

  // Outfits
  getOutfits: () => request<{ items: Outfit[] }>('/outfits'),
  saveOutfit: (payload: {
    name: string;
    topId?: string;
    bottomId?: string;
    shoesId?: string;
  }) =>
    request<Outfit>('/outfits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteOutfit: (id: string) =>
    request<void>(`/outfits/${id}`, { method: 'DELETE' }),

  // Admin
  adminListStores: () => request<{ items: Store[] }>('/admin/stores'),
  adminCreateStore: (payload: { name: string; slug: string; base_url: string }) =>
    request<Store>('/admin/stores', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminDeleteStore: (id: string) =>
    request<void>(`/admin/stores/${id}`, { method: 'DELETE' }),
  adminTriggerScrape: (id: string) =>
    request<{ storeId: string; importedCount: number }>(
      `/admin/stores/${id}/scrape`,
      { method: 'POST' }
    ),
};
