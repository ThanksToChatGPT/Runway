export type Category = 'top' | 'bottom' | 'shoes';

export type PriceSort = 'price_asc' | 'price_desc';

export interface User {
  id: string;
  email: string;
  name: string;
  country: string | null;
  role: 'user' | 'admin';
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: User;
}

export interface PreferencesSummary {
  userId: string;
  priceRange: {
    min: number | null;
    max: number | null;
  };
  maxOutfitBudget: number | null;
  hasPriceRange: boolean;
  hasBudget: boolean;
  currency: 'COP';
}

export interface UpdatePreferencesRequest {
  minPrice?: number | null;
  maxPrice?: number | null;
  maxOutfitBudget?: number | null;
}

export interface StoreRef {
  id: string;
  name: string | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  brand: string | null;
  category: Category;
  subcategory: string | null;
  color: string | null;
  priceCop: number;
  currency: 'COP';
  isSecondHand: boolean;
  primaryImageUrl: string | null;
  availableSizes: string[];
  externalUrl: string;
  store: StoreRef;
}

export interface ProductImageItem {
  url: string;
  isPrimary: boolean;
}

export interface ProductSizeItem {
  size: string;
  isAvailable: boolean;
}

export interface ProductDetail {
  id: string;
  name: string;
  brand: string | null;
  category: Category;
  subcategory: string | null;
  material: string | null;
  color: string | null;
  priceCop: number;
  currency: 'COP';
  rating: number | null;
  isSecondHand: boolean;
  images: ProductImageItem[];
  sizes: ProductSizeItem[];
  externalUrl: string;
  lastPriceUpdate: string | null;
  store: StoreRef;
}

export interface ProductPage {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductComparison {
  products: ProductDetail[];
}

export interface CatalogFacets {
  colors: string[];
  sizes: string[];
  brands: string[];
  subcategories: string[];
  priceRange: {
    min: number | null;
    max: number | null;
  };
}

export interface OutfitPieces {
  top?: string | null;
  bottom?: string | null;
  shoes?: string | null;
}

export interface OutfitPiece {
  productId: string;
  name: string;
  brand: string | null;
  priceCop: number;
  primaryImageUrl: string | null;
  externalUrl: string;
  store: StoreRef;
}

export interface OutfitSlot {
  slotType: Category;
  label: string;
  piece: OutfitPiece | null;
}

export interface OutfitBudget {
  maxBudget: number | null;
  isOverBudget: boolean;
  differenceCop: number | null;
}

export interface Outfit {
  id: string | null;
  isSaved: boolean;
  name: string;
  slots: OutfitSlot[];
  totalCostCop: number;
  currency: 'COP';
  budget: OutfitBudget;
  createdAt: string | null;
}

export interface OutfitItem {
  id: string;
  name: string;
  brand: string | null;
  category: Category;
  subcategory?: string | null;
  color?: string | null;
  priceCop: number;
  primaryImageUrl: string | null;
  externalUrl: string;
  store: StoreRef;
}

export interface Store {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  lastScrapedAt: string | null;
}

export interface ScrapingResult {
  storeId: string;
  status: 'success' | 'failed';
  receivedCount: number;
  discardedCount: number;
  insertedCount: number;
  updatedCount: number;
  finishedAt: string;
  message: string | null;
}
