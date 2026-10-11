-- Admin-managed catalogue taxonomy: audience → category → subcategory

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS subcategory text;

ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_subcategory_len;

ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_subcategory_len
  CHECK (subcategory IS NULL OR char_length(btrim(subcategory)) BETWEEN 1 AND 80);

CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('men', 'women')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL CHECK (char_length(btrim(slug)) BETWEEN 1 AND 80),
  parent_id uuid REFERENCES public.catalog_categories(id) ON DELETE CASCADE,
  display_order smallint NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_parent_not_self CHECK (parent_id IS DISTINCT FROM id)
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_audience_parent_slug_uidx
  ON public.catalog_categories (audience, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS catalog_categories_audience_parent_idx
  ON public.catalog_categories (audience, parent_id, display_order);

ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_categories_public_read ON public.catalog_categories;
CREATE POLICY catalog_categories_public_read ON public.catalog_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.catalog_categories TO anon, authenticated;
GRANT ALL ON public.catalog_categories TO service_role;

CREATE OR REPLACE FUNCTION public.catalog_category_slug(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(btrim(coalesce(_name, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.admin_list_categories(
  _token uuid,
  _audience text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _rows jsonb;
BEGIN
  _email := public.admin_require_email(_token);

  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.audience, c.parent_id NULLS FIRST, c.display_order, c.name), '[]'::jsonb)
  INTO _rows
  FROM public.catalog_categories c
  WHERE (_audience IS NULL OR _audience = 'all' OR c.audience = _audience);

  RETURN jsonb_build_object('email', _email, 'rows', coalesce(_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_category(_token uuid, _category jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _id uuid;
  _audience text;
  _name text;
  _slug text;
  _parent_id uuid;
  _display_order smallint;
  _is_active boolean;
  _parent public.catalog_categories;
  _row public.catalog_categories;
BEGIN
  _email := public.admin_require_email(_token);
  IF _category IS NULL OR jsonb_typeof(_category) <> 'object' THEN
    RAISE EXCEPTION 'Invalid category' USING ERRCODE = '22023';
  END IF;

  _id := NULLIF(_category->>'id', '')::uuid;
  _audience := btrim(coalesce(_category->>'audience', ''));
  _name := btrim(coalesce(_category->>'name', ''));
  _slug := coalesce(NULLIF(btrim(_category->>'slug'), ''), public.catalog_category_slug(_name));
  _parent_id := NULLIF(_category->>'parent_id', '')::uuid;
  _display_order := coalesce(NULLIF(_category->>'display_order', '')::smallint, 0);
  _is_active := coalesce((_category->>'is_active')::boolean, true);

  IF _audience NOT IN ('men', 'women') THEN
    RAISE EXCEPTION 'Audience must be men or women' USING ERRCODE = '22023';
  END IF;
  IF char_length(_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Enter a category name' USING ERRCODE = '22023';
  END IF;
  IF char_length(_slug) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Enter a valid slug' USING ERRCODE = '22023';
  END IF;
  IF _display_order < 0 OR _display_order > 500 THEN
    RAISE EXCEPTION 'Display order must be between 0 and 500' USING ERRCODE = '22023';
  END IF;

  IF _parent_id IS NOT NULL THEN
    SELECT * INTO _parent FROM public.catalog_categories WHERE id = _parent_id;
    IF _parent.id IS NULL THEN
      RAISE EXCEPTION 'Parent category not found' USING ERRCODE = 'P0002';
    END IF;
    IF _parent.audience <> _audience THEN
      RAISE EXCEPTION 'Subcategory audience must match parent' USING ERRCODE = '22023';
    END IF;
    IF _parent.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only one subcategory level is supported' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
    VALUES (_audience, _name, _slug, _parent_id, _display_order, _is_active)
    RETURNING * INTO _row;
  ELSE
    UPDATE public.catalog_categories SET
      audience = _audience,
      name = _name,
      slug = _slug,
      parent_id = _parent_id,
      display_order = _display_order,
      is_active = _is_active,
      updated_at = now()
    WHERE id = _id
    RETURNING * INTO _row;
    IF _row.id IS NULL THEN
      RAISE EXCEPTION 'Category not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN jsonb_build_object('email', _email, 'category', to_jsonb(_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_category(_token uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  _email := public.admin_require_email(_token);
  DELETE FROM public.catalog_categories WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('email', _email, 'deleted', _id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_catalog_product(_token uuid, _product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _id uuid;
  _audience text;
  _category text;
  _subcategory text;
  _retailer text;
  _name text;
  _price numeric;
  _currency text;
  _image_path text;
  _source_image_url text;
  _product_url text;
  _availability text;
  _batch_id uuid;
  _is_active boolean;
  _display_order smallint;
  _row public.catalog_products;
BEGIN
  _email := public.admin_require_email(_token);
  IF _product IS NULL OR jsonb_typeof(_product) <> 'object' THEN
    RAISE EXCEPTION 'Invalid catalogue product' USING ERRCODE = '22023';
  END IF;

  _id := NULLIF(_product->>'id', '')::uuid;
  _audience := btrim(coalesce(_product->>'audience', ''));
  _category := btrim(coalesce(_product->>'category', ''));
  _subcategory := NULLIF(btrim(coalesce(_product->>'subcategory', '')), '');
  _retailer := btrim(coalesce(_product->>'retailer', ''));
  _name := btrim(coalesce(_product->>'product_name', ''));
  _price := NULLIF(_product->>'price', '')::numeric;
  _currency := coalesce(NULLIF(btrim(_product->>'currency'), ''), 'INR');
  _image_path := btrim(coalesce(_product->>'image_path', ''));
  _source_image_url := btrim(coalesce(_product->>'source_image_url', ''));
  _product_url := btrim(coalesce(_product->>'product_url', ''));
  _availability := coalesce(NULLIF(btrim(_product->>'availability'), ''), 'available');
  _batch_id := NULLIF(_product->>'batch_id', '')::uuid;
  _is_active := coalesce((_product->>'is_active')::boolean, false);
  _display_order := coalesce(NULLIF(_product->>'display_order', '')::smallint, 0);

  IF _audience NOT IN ('men', 'women') THEN
    RAISE EXCEPTION 'Audience must be men or women' USING ERRCODE = '22023';
  END IF;
  IF char_length(_category) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Enter a category' USING ERRCODE = '22023';
  END IF;
  IF _subcategory IS NOT NULL AND char_length(_subcategory) > 80 THEN
    RAISE EXCEPTION 'Subcategory is too long' USING ERRCODE = '22023';
  END IF;
  IF char_length(_retailer) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Enter a retailer' USING ERRCODE = '22023';
  END IF;
  IF char_length(_name) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Enter a product name' USING ERRCODE = '22023';
  END IF;
  IF _price IS NULL OR _price <= 0 THEN
    RAISE EXCEPTION 'Enter a price greater than 0' USING ERRCODE = '22023';
  END IF;
  IF _currency <> 'INR' THEN
    RAISE EXCEPTION 'Currency must be INR' USING ERRCODE = '22023';
  END IF;
  IF char_length(_image_path) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Enter an image path or HTTPS image URL' USING ERRCODE = '22023';
  END IF;
  IF _source_image_url !~ '^https://' THEN
    RAISE EXCEPTION 'Source image URL must start with https://' USING ERRCODE = '22023';
  END IF;
  IF _product_url !~ '^https://' THEN
    RAISE EXCEPTION 'Retailer URL must start with https://' USING ERRCODE = '22023';
  END IF;
  IF _availability NOT IN ('available', 'unavailable', 'unknown') THEN
    RAISE EXCEPTION 'Invalid availability' USING ERRCODE = '22023';
  END IF;
  IF _display_order < 0 OR _display_order > 100 THEN
    RAISE EXCEPTION 'Display order must be between 0 and 100' USING ERRCODE = '22023';
  END IF;
  IF _batch_id IS NULL THEN
    _batch_id := coalesce((SELECT batch_id FROM public.catalog_products ORDER BY refreshed_at DESC LIMIT 1), gen_random_uuid());
  END IF;

  -- Ensure taxonomy rows exist for selected labels so admin lists stay complete.
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_categories c
    WHERE c.audience = _audience AND c.parent_id IS NULL AND c.slug = public.catalog_category_slug(_category)
  ) THEN
    INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
    VALUES (_audience, _category, public.catalog_category_slug(_category), NULL, 0, true);
  END IF;

  IF _subcategory IS NOT NULL THEN
    INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
    SELECT _audience, _subcategory, public.catalog_category_slug(_subcategory), c.id, 0, true
    FROM public.catalog_categories c
    WHERE c.audience = _audience
      AND c.parent_id IS NULL
      AND c.slug = public.catalog_category_slug(_category)
      AND NOT EXISTS (
        SELECT 1 FROM public.catalog_categories s
        WHERE s.audience = _audience
          AND s.parent_id = c.id
          AND s.slug = public.catalog_category_slug(_subcategory)
      );
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.catalog_products (
      audience, category, subcategory, retailer, product_name, price, currency, image_path, source_image_url,
      product_url, availability, batch_id, is_active, display_order, refreshed_at
    ) VALUES (
      _audience, _category, _subcategory, _retailer, _name, _price, _currency, _image_path, _source_image_url,
      _product_url, _availability, _batch_id, _is_active, _display_order, now()
    )
    RETURNING * INTO _row;
  ELSE
    UPDATE public.catalog_products SET
      audience = _audience,
      category = _category,
      subcategory = _subcategory,
      retailer = _retailer,
      product_name = _name,
      price = _price,
      currency = _currency,
      image_path = _image_path,
      source_image_url = _source_image_url,
      product_url = _product_url,
      availability = _availability,
      batch_id = _batch_id,
      is_active = _is_active,
      display_order = _display_order,
      refreshed_at = now()
    WHERE id = _id
    RETURNING * INTO _row;
    IF _row.id IS NULL THEN
      RAISE EXCEPTION 'Catalogue product not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN jsonb_build_object('email', _email, 'product', to_jsonb(_row));
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_category_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_categories(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_category(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_category(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_category_slug(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_categories(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_category(uuid, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_category(uuid, uuid) TO anon, authenticated, service_role;

-- Seed top-level categories (includes current product labels + future-ready set)
WITH seed(audience, name, display_order) AS (
  VALUES
    ('men', 'T-shirts', 10),
    ('men', 'Shirts & layers', 20),
    ('men', 'Shirts', 25),
    ('men', 'Trousers', 30),
    ('men', 'Pants', 35),
    ('men', 'Jeans', 40),
    ('men', 'Knitwear', 50),
    ('men', 'Hoodies', 55),
    ('men', 'Jackets', 60),
    ('men', 'Ethnic', 70),
    ('men', 'Accessories', 80),
    ('men', 'Other', 90),
    ('women', 'Dresses & sets', 10),
    ('women', 'Dresses', 15),
    ('women', 'Tops', 20),
    ('women', 'T-shirts', 25),
    ('women', 'Shirts', 30),
    ('women', 'Denim', 40),
    ('women', 'Jeans', 45),
    ('women', 'Pants', 50),
    ('women', 'Skirts', 55),
    ('women', 'Outerwear', 60),
    ('women', 'Jackets', 65),
    ('women', 'Ethnic', 70),
    ('women', 'Sets', 75),
    ('women', 'Accessories', 80),
    ('women', 'Other', 90)
)
INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
SELECT s.audience, s.name, public.catalog_category_slug(s.name), NULL, s.display_order, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_categories c
  WHERE c.audience = s.audience
    AND c.parent_id IS NULL
    AND c.slug = public.catalog_category_slug(s.name)
);

-- Seed useful subcategories
WITH parents AS (
  SELECT id, audience, slug FROM public.catalog_categories WHERE parent_id IS NULL
),
subs(audience, parent_slug, name, display_order) AS (
  VALUES
    ('men', 't-shirts', 'Polo', 10),
    ('men', 't-shirts', 'Crew neck', 20),
    ('men', 't-shirts', 'Graphic', 30),
    ('men', 'shirts-layers', 'Casual', 10),
    ('men', 'shirts-layers', 'Formal', 20),
    ('men', 'shirts-layers', 'Overshirts', 30),
    ('men', 'shirts', 'Casual', 10),
    ('men', 'shirts', 'Formal', 20),
    ('men', 'trousers', 'Chinos', 10),
    ('men', 'trousers', 'Joggers', 20),
    ('men', 'pants', 'Chinos', 10),
    ('men', 'pants', 'Joggers', 20),
    ('men', 'knitwear', 'Sweaters', 10),
    ('men', 'knitwear', 'Cardigans', 20),
    ('men', 'hoodies', 'Pullover', 10),
    ('men', 'hoodies', 'Zip-up', 20),
    ('women', 'dresses-sets', 'Casual', 10),
    ('women', 'dresses-sets', 'Party', 20),
    ('women', 'dresses-sets', 'Co-ords', 30),
    ('women', 'dresses', 'Casual', 10),
    ('women', 'dresses', 'Party', 20),
    ('women', 'tops', 'Blouses', 10),
    ('women', 'tops', 'Tunics', 20),
    ('women', 'tops', 'Crop tops', 30),
    ('women', 't-shirts', 'Basic', 10),
    ('women', 't-shirts', 'Graphic', 20),
    ('women', 'denim', 'Jeans', 10),
    ('women', 'denim', 'Jackets', 20),
    ('women', 'outerwear', 'Jackets', 10),
    ('women', 'outerwear', 'Coats', 20)
)
INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
SELECT s.audience, s.name, public.catalog_category_slug(s.name), p.id, s.display_order, true
FROM subs s
JOIN parents p ON p.audience = s.audience AND p.slug = s.parent_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_categories c
  WHERE c.audience = s.audience
    AND c.parent_id = p.id
    AND c.slug = public.catalog_category_slug(s.name)
);

-- Pull any product categories that are not yet in taxonomy
INSERT INTO public.catalog_categories (audience, name, slug, parent_id, display_order, is_active)
SELECT DISTINCT p.audience, p.category, public.catalog_category_slug(p.category), NULL::uuid, 100, true
FROM public.catalog_products p
WHERE coalesce(btrim(p.category), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_categories c
    WHERE c.audience = p.audience
      AND c.parent_id IS NULL
      AND c.slug = public.catalog_category_slug(p.category)
  );
