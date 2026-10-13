-- Drag-and-drop reorder for category siblings and catalogue products.

CREATE OR REPLACE FUNCTION public.admin_reorder_categories(
  _token uuid,
  _audience text,
  _parent_id uuid,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _expected int;
  _matched int;
BEGIN
  _email := public.admin_require_email(_token);

  IF _audience NOT IN ('men', 'women') THEN
    RAISE EXCEPTION 'Audience must be men or women' USING ERRCODE = '22023';
  END IF;
  IF _ids IS NULL OR cardinality(_ids) = 0 THEN
    RAISE EXCEPTION 'Provide at least one category id' USING ERRCODE = '22023';
  END IF;
  IF cardinality(_ids) <> (SELECT count(DISTINCT x) FROM unnest(_ids) AS x) THEN
    RAISE EXCEPTION 'Duplicate category ids are not allowed' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO _expected
  FROM public.catalog_categories c
  WHERE c.audience = _audience
    AND c.parent_id IS NOT DISTINCT FROM _parent_id;

  SELECT count(*)::int INTO _matched
  FROM public.catalog_categories c
  WHERE c.audience = _audience
    AND c.parent_id IS NOT DISTINCT FROM _parent_id
    AND c.id = ANY (_ids);

  IF _matched <> cardinality(_ids) OR _matched <> _expected THEN
    RAISE EXCEPTION 'Reorder list must include every category in this group exactly once' USING ERRCODE = '22023';
  END IF;

  UPDATE public.catalog_categories c
  SET display_order = (ord.ord - 1)::smallint,
      updated_at = now()
  FROM unnest(_ids) WITH ORDINALITY AS ord(id, ord)
  WHERE c.id = ord.id;

  RETURN jsonb_build_object('email', _email, 'reordered', cardinality(_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reorder_catalog_products(
  _token uuid,
  _audience text,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _matched int;
  _slots smallint[];
BEGIN
  _email := public.admin_require_email(_token);

  IF _audience NOT IN ('men', 'women') THEN
    RAISE EXCEPTION 'Audience must be men or women' USING ERRCODE = '22023';
  END IF;
  IF _ids IS NULL OR cardinality(_ids) = 0 THEN
    RAISE EXCEPTION 'Provide at least one product id' USING ERRCODE = '22023';
  END IF;
  IF cardinality(_ids) <> (SELECT count(DISTINCT x) FROM unnest(_ids) AS x) THEN
    RAISE EXCEPTION 'Duplicate product ids are not allowed' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO _matched
  FROM public.catalog_products p
  WHERE p.audience = _audience
    AND p.id = ANY (_ids);

  IF _matched <> cardinality(_ids) THEN
    RAISE EXCEPTION 'Every product must belong to this catalogue' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(p.display_order ORDER BY p.display_order ASC, p.id ASC), ARRAY[]::smallint[])
  INTO _slots
  FROM public.catalog_products p
  WHERE p.id = ANY (_ids);

  UPDATE public.catalog_products p
  SET display_order = _slots[ord.ord],
      updated_at = now()
  FROM unnest(_ids) WITH ORDINALITY AS ord(id, ord)
  WHERE p.id = ord.id;

  RETURN jsonb_build_object('email', _email, 'reordered', cardinality(_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reorder_categories(uuid, text, uuid, uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_products(uuid, text, uuid[]) TO anon, authenticated, service_role;
