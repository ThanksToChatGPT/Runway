
-- Seguridad de las tablas en Supabase.
-- El acceso a los datos se gestiona desde el backend.

BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_size_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_slots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.users,
    public.user_preferences,
    public.stores,
    public.products,
    public.product_images,
    public.product_size_stocks,
    public.outfits,
    public.outfit_slots
FROM anon, authenticated;

COMMIT;
