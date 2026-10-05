CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('men', 'women')),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  retailer text NOT NULL CHECK (char_length(retailer) BETWEEN 1 AND 100),
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 240),
  price numeric(12,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  image_path text NOT NULL CHECK (char_length(image_path) BETWEEN 1 AND 500),
  source_image_url text NOT NULL CHECK (source_image_url ~ '^https://'),
  product_url text NOT NULL UNIQUE CHECK (product_url ~ '^https://'),
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'unavailable', 'unknown')),
  batch_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  display_order smallint NOT NULL CHECK (display_order BETWEEN 0 AND 100),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_products TO anon, authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_products_public_active_read" ON public.catalog_products FOR SELECT TO anon, authenticated USING (is_active AND availability = 'available');
CREATE INDEX catalog_products_active_audience_order_idx ON public.catalog_products (audience, display_order) WHERE is_active AND availability = 'available';
CREATE INDEX catalog_products_batch_idx ON public.catalog_products (batch_id);
CREATE TRIGGER catalog_products_updated_at BEFORE UPDATE ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_generation_cooldowns (
  client_hash text PRIMARY KEY CHECK (char_length(client_hash) = 64),
  last_generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_generation_cooldowns TO service_role;
ALTER TABLE public.ai_generation_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_generation_cooldowns_updated_at BEFORE UPDATE ON public.ai_generation_cooldowns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.saved_looks
  ADD COLUMN catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN product_name text,
  ADD COLUMN product_retailer text,
  ADD COLUMN product_price numeric(12,2),
  ADD COLUMN product_currency text,
  ADD COLUMN style_note text NOT NULL DEFAULT '';

ALTER TABLE public.saved_looks
  ADD CONSTRAINT saved_looks_product_name_length CHECK (product_name IS NULL OR char_length(product_name) BETWEEN 1 AND 240),
  ADD CONSTRAINT saved_looks_product_retailer_length CHECK (product_retailer IS NULL OR char_length(product_retailer) BETWEEN 1 AND 100),
  ADD CONSTRAINT saved_looks_product_price_positive CHECK (product_price IS NULL OR product_price > 0),
  ADD CONSTRAINT saved_looks_product_currency_inr CHECK (product_currency IS NULL OR product_currency = 'INR'),
  ADD CONSTRAINT saved_looks_style_note_length CHECK (char_length(style_note) <= 280);

CREATE INDEX saved_looks_catalog_product_idx ON public.saved_looks (catalog_product_id);