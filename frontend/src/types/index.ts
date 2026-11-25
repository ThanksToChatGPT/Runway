export type Category = 'top' | 'bottom' | 'shoes';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface UserPreferences {
  user_id?: string;
  min_price_cop: number;
  max_price_cop: number;
  budget_limit_cop: number;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  is_active: boolean;
}

export interface ProductImage {
  image_url: string;
  is_primary: boolean;
}

export interface ProductSizeStock {
  size: string;
  in_stock: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  store_name: string;
  store_url?: string;
  external_id?: string;
  title: string;
  brand: string;
  category: Category;
  color: string;
  price_cop: number;
  product_url: string;
  images: ProductImage[];
  sizes: ProductSizeStock[];
}

export interface ProductSearchResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface OutfitSlotItem {
  slot_type: Category;
  product_id: string;
  title: string;
  brand: string;
  price_cop: number;
  product_url: string;
  store_name: string;
  image_url?: string | null;
}

export interface Outfit {
  id: string;
  name: string;
  total_cop: number;
  created_at: string;
  slots: OutfitSlotItem[];
}
