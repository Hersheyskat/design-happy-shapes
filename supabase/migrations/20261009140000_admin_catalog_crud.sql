CREATE OR REPLACE FUNCTION public.admin_require_email(_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT u.email INTO _email
  FROM public.admin_sessions s
  JOIN public.admin_users u ON u.id = s.admin_id
  WHERE s.token = _token AND s.expires_at > now();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Admin session expired' USING ERRCODE = '28000';
  END IF;
  RETURN _email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_catalog(
  _token uuid,
  _search text DEFAULT '',
  _audience text DEFAULT NULL,
  _availability text DEFAULT NULL,
  _active text DEFAULT NULL,
  _retailer text DEFAULT NULL,
  _sort text DEFAULT 'display_order',
  _dir text DEFAULT 'asc',
  _limit int DEFAULT 25,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _q text;
  _page_size int;
  _page_offset int;
  _sort_key text;
  _sort_dir text;
  _rows jsonb;
  _total int;
  _retailers jsonb;
  _categories jsonb;
BEGIN
  _email := public.admin_require_email(_token);
  _q := lower(btrim(regexp_replace(coalesce(_search, ''), '[%_\\]', '', 'g')));
  IF char_length(_q) > 120 THEN
    _q := left(_q, 120);
  END IF;
  _page_size := least(greatest(coalesce(_limit, 25), 1), 100);
  _page_offset := greatest(coalesce(_offset, 0), 0);
  _sort_key := CASE coalesce(_sort, 'display_order')
    WHEN 'product_name' THEN 'product_name'
    WHEN 'retailer' THEN 'retailer'
    WHEN 'price' THEN 'price'
    WHEN 'audience' THEN 'audience'
    WHEN 'created_at' THEN 'created_at'
    WHEN 'refreshed_at' THEN 'refreshed_at'
    ELSE 'display_order'
  END;
  _sort_dir := CASE WHEN lower(coalesce(_dir, 'asc')) = 'desc' THEN 'desc' ELSE 'asc' END;

  WITH filtered AS (
    SELECT c.*
    FROM public.catalog_products c
    WHERE (_audience IS NULL OR _audience = 'all' OR c.audience = _audience)
      AND (_availability IS NULL OR _availability = 'all' OR c.availability = _availability)
      AND (
        _active IS NULL OR _active = 'all'
        OR (_active = 'yes' AND c.is_active)
        OR (_active = 'no' AND NOT c.is_active)
      )
      AND (_retailer IS NULL OR _retailer = 'all' OR _retailer = '' OR c.retailer = _retailer)
      AND (
        _q = ''
        OR c.product_name ILIKE '%' || _q || '%'
        OR c.retailer ILIKE '%' || _q || '%'
        OR c.category ILIKE '%' || _q || '%'
        OR c.product_url ILIKE '%' || _q || '%'
      )
  )
  SELECT
    count(*)::int,
    coalesce((
        SELECT jsonb_agg(to_jsonb(r) - 'seq' ORDER BY r.seq)
      FROM (
        SELECT f.*, row_number() OVER () AS seq
        FROM (
          SELECT *
          FROM filtered src
          ORDER BY
            CASE WHEN _sort_key = 'product_name' AND _sort_dir = 'asc' THEN src.product_name END ASC NULLS LAST,
            CASE WHEN _sort_key = 'product_name' AND _sort_dir = 'desc' THEN src.product_name END DESC NULLS LAST,
            CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'asc' THEN src.retailer END ASC NULLS LAST,
            CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'desc' THEN src.retailer END DESC NULLS LAST,
            CASE WHEN _sort_key = 'price' AND _sort_dir = 'asc' THEN src.price END ASC NULLS LAST,
            CASE WHEN _sort_key = 'price' AND _sort_dir = 'desc' THEN src.price END DESC NULLS LAST,
            CASE WHEN _sort_key = 'audience' AND _sort_dir = 'asc' THEN src.audience END ASC NULLS LAST,
            CASE WHEN _sort_key = 'audience' AND _sort_dir = 'desc' THEN src.audience END DESC NULLS LAST,
            CASE WHEN _sort_key = 'created_at' AND _sort_dir = 'asc' THEN src.created_at END ASC,
            CASE WHEN _sort_key = 'created_at' AND _sort_dir = 'desc' THEN src.created_at END DESC,
            CASE WHEN _sort_key = 'refreshed_at' AND _sort_dir = 'asc' THEN src.refreshed_at END ASC,
            CASE WHEN _sort_key = 'refreshed_at' AND _sort_dir = 'desc' THEN src.refreshed_at END DESC,
            CASE WHEN _sort_dir = 'asc' THEN src.display_order END ASC,
            CASE WHEN _sort_dir = 'desc' THEN src.display_order END DESC,
            src.display_order ASC
          LIMIT _page_size OFFSET _page_offset
        ) f
      ) r
    ), '[]'::jsonb)
  INTO _total, _rows
  FROM filtered;

  SELECT coalesce(jsonb_agg(retailer ORDER BY retailer), '[]'::jsonb)
  INTO _retailers
  FROM (SELECT DISTINCT retailer FROM public.catalog_products) s;

  SELECT coalesce(jsonb_agg(category ORDER BY category), '[]'::jsonb)
  INTO _categories
  FROM (SELECT DISTINCT category FROM public.catalog_products) s;

  RETURN jsonb_build_object(
    'email', _email,
    'total', coalesce(_total, 0),
    'limit', _page_size,
    'offset', _page_offset,
    'rows', coalesce(_rows, '[]'::jsonb),
    'retailers', coalesce(_retailers, '[]'::jsonb),
    'categories', coalesce(_categories, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_catalog_product(_token uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _row jsonb;
BEGIN
  _email := public.admin_require_email(_token);
  SELECT to_jsonb(c) INTO _row FROM public.catalog_products c WHERE c.id = _id;
  IF _row IS NULL THEN
    RAISE EXCEPTION 'Catalogue product not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('email', _email, 'product', _row);
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

  IF _id IS NULL THEN
    INSERT INTO public.catalog_products (
      audience, category, retailer, product_name, price, currency, image_path, source_image_url,
      product_url, availability, batch_id, is_active, display_order, refreshed_at
    ) VALUES (
      _audience, _category, _retailer, _name, _price, _currency, _image_path, _source_image_url,
      _product_url, _availability, _batch_id, _is_active, _display_order, now()
    )
    RETURNING * INTO _row;
  ELSE
    UPDATE public.catalog_products SET
      audience = _audience,
      category = _category,
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

CREATE OR REPLACE FUNCTION public.admin_delete_catalog_product(_token uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  _email := public.admin_require_email(_token);
  DELETE FROM public.catalog_products WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalogue product not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('email', _email, 'deleted', _id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_require_email(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_catalog(uuid, text, text, text, text, text, text, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_catalog_product(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_catalog_product(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_catalog_product(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_email(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_catalog(uuid, text, text, text, text, text, text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_catalog_product(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_catalog_product(uuid, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_catalog_product(uuid, uuid) TO anon, authenticated, service_role;

INSERT INTO public.catalog_products (
  audience, category, retailer, product_name, price, currency, image_path, source_image_url,
  product_url, availability, batch_id, is_active, display_order, refreshed_at
)
VALUES
  (
    'men',
    'Shirts & layers',
    'Amazon India',
    'Symbol Premium Men''s Casual Cotton Poplin Shirt (Regular Fit)',
    999,
    'INR',
    'https://m.media-amazon.com/images/I/41inBQPfM2L._SX342_SY445_QL70_FMwebp_.jpg',
    'https://m.media-amazon.com/images/I/41inBQPfM2L._SX342_SY445_QL70_FMwebp_.jpg',
    'https://www.amazon.in/dp/B0DPKPJSKW',
    'available',
    '5aaffdc7-85f4-439c-9472-2d84caa53e7b',
    true,
    0,
    now()
  ),
  (
    'women',
    'Dresses & sets',
    'Amazon India',
    'FableStreet Satin Cowl Neck Slip Dress - Olive',
    1977,
    'INR',
    'https://m.media-amazon.com/images/I/31wAD3xaikL._SY445_SX342_QL70_FMwebp_.jpg',
    'https://m.media-amazon.com/images/I/31wAD3xaikL._SY445_SX342_QL70_FMwebp_.jpg',
    'https://www.amazon.in/dp/B0CQHSMH7T',
    'available',
    '5aaffdc7-85f4-439c-9472-2d84caa53e7b',
    true,
    1,
    now()
  )
ON CONFLICT (product_url) DO NOTHING;
