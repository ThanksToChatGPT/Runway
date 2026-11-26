-- Outfit Builder — Esquema del MVP (Release 1)
-- Fuente: docs/mvp_design_data_model.md (8 tablas).
-- Montos en COP con NUMERIC(12,2) (BR-03). Los adaptadores Pg* los mapean a Number.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  auth_provider VARCHAR(30) NOT NULL DEFAULT 'local',
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100),
  role VARCHAR(30) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. user_preferences (0..1 por usuario)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  min_price NUMERIC(12,2) CHECK (min_price >= 0),
  max_price NUMERIC(12,2) CHECK (max_price >= 0),
  max_outfit_budget NUMERIC(12,2) CHECK (max_outfit_budget >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_preferences_price_range
    CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price)
);

-- 3. stores
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  base_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(150),
  category VARCHAR(100) NOT NULL CHECK (category IN ('top', 'bottom', 'shoes')),
  subcategory VARCHAR(100),
  material VARCHAR(150),
  color VARCHAR(100),
  price_cop NUMERIC(12,2) NOT NULL CHECK (price_cop >= 0),
  rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
  is_second_hand BOOLEAN NOT NULL DEFAULT FALSE,
  external_url TEXT NOT NULL,
  last_price_update TIMESTAMPTZ,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un producto se identifica por su tienda + URL externa (upsert del scraping).
  CONSTRAINT uq_products_store_external_url UNIQUE (store_id, external_url)
);

CREATE INDEX IF NOT EXISTS idx_products_category_price ON products (category, price_cop);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_products_color ON products (color);

-- 5. product_images
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id);

-- 6. product_size_stocks
CREATE TABLE IF NOT EXISTS product_size_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(30) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_product_size UNIQUE (product_id, size)
);

-- 7. outfits
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  total_cost_cop NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_cost_cop >= 0),
  is_over_budget BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfits_user_created ON outfits (user_id, created_at DESC);

-- 8. outfit_slots (siempre 3 por outfit; la prenda es opcional)
CREATE TABLE IF NOT EXISTS outfit_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  slot_type VARCHAR(60) NOT NULL CHECK (slot_type IN ('top', 'bottom', 'shoes')),
  CONSTRAINT uq_outfit_slot UNIQUE (outfit_id, slot_type)
);
