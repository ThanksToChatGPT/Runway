CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  min_price_cop INTEGER NOT NULL DEFAULT 0 CHECK (min_price_cop >= 0),
  max_price_cop INTEGER NOT NULL DEFAULT 500000 CHECK (max_price_cop >= 0),
  budget_limit_cop INTEGER NOT NULL DEFAULT 500000 CHECK (budget_limit_cop >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_preferences_price_range CHECK (min_price_cop <= max_price_cop)
);

-- 3. stores
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  base_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  brand VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('top', 'bottom', 'shoes')),
  color VARCHAR(60) NOT NULL,
  price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
  product_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_products_category_price ON products (category, price_cop);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_color ON products (color);

-- 5. product_images
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 6. product_size_stocks
CREATE TABLE IF NOT EXISTS product_size_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(20) NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (product_id, size)
);

-- 7. outfits
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. outfit_slots
CREATE TABLE IF NOT EXISTS outfit_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  slot_type VARCHAR(20) NOT NULL CHECK (slot_type IN ('top', 'bottom', 'shoes')),
  UNIQUE (outfit_id, slot_type)
);
