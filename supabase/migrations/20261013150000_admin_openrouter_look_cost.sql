-- Surface per-look OpenRouter cost (metadata.openrouter_cost_usd) on admin user list + detail.

CREATE OR REPLACE FUNCTION public.admin_list_users(
  _token uuid,
  _search text DEFAULT '',
  _range text DEFAULT 'all',
  _from_date date DEFAULT NULL,
  _to_date date DEFAULT NULL,
  _sort text DEFAULT 'created_at',
  _dir text DEFAULT 'desc',
  _limit integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _q text;
  _from timestamptz;
  _until timestamptz;
  _page_size int;
  _page_offset int;
  _sort_key text;
  _sort_dir text;
  _rows jsonb;
  _total int;
  _start date;
  _end date;
BEGIN
  SELECT u.email INTO _email
  FROM public.admin_sessions s
  JOIN public.admin_users u ON u.id = s.admin_id
  WHERE s.token = _token AND s.expires_at > now();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Admin session expired' USING ERRCODE = '28000';
  END IF;

  _q := lower(btrim(regexp_replace(coalesce(_search, ''), '[%_\\]', '', 'g')));
  IF char_length(_q) > 120 THEN
    _q := left(_q, 120);
  END IF;

  IF _from_date IS NOT NULL OR _to_date IS NOT NULL THEN
    _start := _from_date;
    _end := coalesce(_to_date, (timezone('utc', now()))::date);
    IF _start IS NOT NULL AND _start > _end THEN
      _from := (_end::timestamp AT TIME ZONE 'UTC');
      _until := ((_start + 1)::timestamp AT TIME ZONE 'UTC');
    ELSE
      _from := CASE WHEN _start IS NULL THEN NULL ELSE (_start::timestamp AT TIME ZONE 'UTC') END;
      _until := ((_end + 1)::timestamp AT TIME ZONE 'UTC');
    END IF;
  ELSE
    _from := CASE coalesce(_range, 'all')
      WHEN '24h' THEN now() - interval '24 hours'
      WHEN '7d' THEN now() - interval '7 days'
      WHEN '14d' THEN now() - interval '14 days'
      WHEN '30d' THEN now() - interval '30 days'
      WHEN '90d' THEN now() - interval '90 days'
      ELSE NULL
    END;
    _until := NULL;
  END IF;

  _page_size := least(greatest(coalesce(_limit, 25), 1), 100);
  _page_offset := greatest(coalesce(_offset, 0), 0);
  _sort_key := CASE coalesce(_sort, 'created_at')
    WHEN 'email' THEN 'email'
    WHEN 'name' THEN 'name'
    WHEN 'handle' THEN 'handle'
    WHEN 'last_sign_in_at' THEN 'last_sign_in_at'
    WHEN 'looks' THEN 'looks'
    WHEN 'saves' THEN 'saves'
    WHEN 'buys' THEN 'buys'
    WHEN 'shares' THEN 'shares'
    WHEN 'ai_cost_usd' THEN 'ai_cost_usd'
    ELSE 'created_at'
  END;
  _sort_dir := CASE WHEN lower(coalesce(_dir, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;

  WITH filtered AS (
    SELECT
      p.id,
      p.handle,
      p.display_name,
      p.first_name,
      p.surname,
      p.created_at,
      p.updated_at,
      au.email,
      au.last_sign_in_at,
      au.email_confirmed_at,
      coalesce((
        SELECT count(*)::int
        FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'look_created'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS looks,
      coalesce((
        SELECT count(*)::int FROM public.saved_looks sl
        WHERE sl.user_id = p.id AND coalesce(sl.product_name,'') NOT ILIKE 'Dummy:%'
      ), 0) AS saves,
      coalesce((
        SELECT count(*)::int
        FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'buy_click'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS buys,
      coalesce((
        SELECT count(*)::int
        FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'share_click'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS shares,
      coalesce((
        SELECT sum(
          CASE
            WHEN jsonb_typeof(e.metadata->'openrouter_cost_usd') = 'number'
              THEN (e.metadata->>'openrouter_cost_usd')::numeric
            WHEN (e.metadata->>'openrouter_cost_usd') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (e.metadata->>'openrouter_cost_usd')::numeric
            ELSE 0::numeric
          END
        )
        FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'look_created'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0)::float8 AS ai_cost_usd,
      lower(coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(concat_ws(' ', p.first_name, p.surname)), ''), p.handle, '')) AS name_sort
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE (_from IS NULL OR p.created_at >= _from)
      AND (_until IS NULL OR p.created_at < _until)
      AND (
        _q = ''
        OR coalesce(au.email, '') ILIKE '%' || _q || '%'
        OR coalesce(p.handle, '') ILIKE '%' || _q || '%'
        OR coalesce(p.display_name, '') ILIKE '%' || _q || '%'
        OR coalesce(p.first_name, '') ILIKE '%' || _q || '%'
        OR coalesce(p.surname, '') ILIKE '%' || _q || '%'
      )
  )
  SELECT
    count(*)::int,
    coalesce((
      SELECT jsonb_agg(to_jsonb(r) - 'name_sort' - 'seq' ORDER BY r.seq)
      FROM (
        SELECT f.*, row_number() OVER () AS seq
        FROM (
          SELECT *
          FROM filtered src
          ORDER BY
            CASE WHEN _sort_key = 'email' AND _sort_dir = 'asc' THEN src.email END ASC NULLS LAST,
            CASE WHEN _sort_key = 'email' AND _sort_dir = 'desc' THEN src.email END DESC NULLS LAST,
            CASE WHEN _sort_key = 'name' AND _sort_dir = 'asc' THEN src.name_sort END ASC NULLS LAST,
            CASE WHEN _sort_key = 'name' AND _sort_dir = 'desc' THEN src.name_sort END DESC NULLS LAST,
            CASE WHEN _sort_key = 'handle' AND _sort_dir = 'asc' THEN src.handle END ASC NULLS LAST,
            CASE WHEN _sort_key = 'handle' AND _sort_dir = 'desc' THEN src.handle END DESC NULLS LAST,
            CASE WHEN _sort_key = 'last_sign_in_at' AND _sort_dir = 'asc' THEN src.last_sign_in_at END ASC NULLS LAST,
            CASE WHEN _sort_key = 'last_sign_in_at' AND _sort_dir = 'desc' THEN src.last_sign_in_at END DESC NULLS LAST,
            CASE WHEN _sort_key = 'looks' AND _sort_dir = 'asc' THEN src.looks END ASC NULLS LAST,
            CASE WHEN _sort_key = 'looks' AND _sort_dir = 'desc' THEN src.looks END DESC NULLS LAST,
            CASE WHEN _sort_key = 'saves' AND _sort_dir = 'asc' THEN src.saves END ASC NULLS LAST,
            CASE WHEN _sort_key = 'saves' AND _sort_dir = 'desc' THEN src.saves END DESC NULLS LAST,
            CASE WHEN _sort_key = 'buys' AND _sort_dir = 'asc' THEN src.buys END ASC NULLS LAST,
            CASE WHEN _sort_key = 'buys' AND _sort_dir = 'desc' THEN src.buys END DESC NULLS LAST,
            CASE WHEN _sort_key = 'shares' AND _sort_dir = 'asc' THEN src.shares END ASC NULLS LAST,
            CASE WHEN _sort_key = 'shares' AND _sort_dir = 'desc' THEN src.shares END DESC NULLS LAST,
            CASE WHEN _sort_key = 'ai_cost_usd' AND _sort_dir = 'asc' THEN src.ai_cost_usd END ASC NULLS LAST,
            CASE WHEN _sort_key = 'ai_cost_usd' AND _sort_dir = 'desc' THEN src.ai_cost_usd END DESC NULLS LAST,
            CASE WHEN _sort_dir = 'asc' THEN src.created_at END ASC,
            CASE WHEN _sort_dir = 'desc' THEN src.created_at END DESC,
            src.created_at DESC
          LIMIT _page_size OFFSET _page_offset
        ) f
      ) r
    ), '[]'::jsonb)
  INTO _total, _rows
  FROM filtered;

  RETURN jsonb_build_object(
    'email', _email,
    'total', coalesce(_total, 0),
    'limit', _page_size,
    'offset', _page_offset,
    'rows', coalesce(_rows, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user(_token uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _profile jsonb;
  _looks jsonb;
  _saves jsonb;
  _buys jsonb;
  _shares jsonb;
BEGIN
  SELECT u.email INTO _email
  FROM public.admin_sessions s
  JOIN public.admin_users u ON u.id = s.admin_id
  WHERE s.token = _token AND s.expires_at > now();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Admin session expired' USING ERRCODE = '28000';
  END IF;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(r) INTO _profile
  FROM (
    SELECT
      p.id,
      p.handle,
      p.display_name,
      p.first_name,
      p.surname,
      p.bio,
      p.avatar_path,
      p.style_preferences,
      p.created_at,
      p.updated_at,
      au.email,
      au.last_sign_in_at,
      au.email_confirmed_at,
      au.created_at AS auth_created_at,
      coalesce((
        SELECT count(*)::int FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'look_created'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS looks,
      coalesce((
        SELECT count(*)::int FROM public.saved_looks sl
        WHERE sl.user_id = p.id AND coalesce(sl.product_name,'') NOT ILIKE 'Dummy:%'
      ), 0) AS saves,
      coalesce((
        SELECT count(*)::int FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'buy_click'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS buys,
      coalesce((
        SELECT count(*)::int FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'share_click'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0) AS shares,
      coalesce((
        SELECT sum(
          CASE
            WHEN jsonb_typeof(e.metadata->'openrouter_cost_usd') = 'number'
              THEN (e.metadata->>'openrouter_cost_usd')::numeric
            WHEN (e.metadata->>'openrouter_cost_usd') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (e.metadata->>'openrouter_cost_usd')::numeric
            ELSE 0::numeric
          END
        )
        FROM public.shopper_events e
        WHERE e.user_id = p.id AND e.event_type = 'look_created'
          AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
      ), 0)::float8 AS ai_cost_usd
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE p.id = _id
  ) r;

  IF _profile IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO _looks
  FROM (
    SELECT
      e.id,
      e.actor_type,
      e.user_id,
      e.catalog_product_id,
      e.channel,
      e.metadata,
      e.created_at,
      c.product_name,
      c.retailer,
      c.audience,
      c.price,
      c.currency,
      c.product_url,
      coalesce(e.look_image_path, c.image_path) AS image_path,
      CASE
        WHEN jsonb_typeof(e.metadata->'openrouter_cost_usd') = 'number'
          THEN (e.metadata->>'openrouter_cost_usd')::float8
        WHEN (e.metadata->>'openrouter_cost_usd') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (e.metadata->>'openrouter_cost_usd')::float8
        ELSE NULL
      END AS ai_cost_usd
    FROM public.shopper_events e
    LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
    WHERE e.user_id = _id AND e.event_type = 'look_created'
      AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
    ORDER BY e.created_at DESC
    LIMIT 100
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO _saves
  FROM (
    SELECT
      sl.id,
      sl.user_id,
      sl.catalog_product_id,
      sl.product_name,
      sl.product_retailer AS retailer,
      sl.product_price AS price,
      sl.product_currency AS currency,
      sl.product_url,
      sl.mood,
      sl.headline,
      sl.summary,
      sl.style_note,
      sl.is_published,
      sl.is_removed,
      sl.share_slug,
      sl.created_at,
      sl.updated_at,
      sl.shopper_image_path AS image_path
    FROM public.saved_looks sl
    WHERE sl.user_id = _id
      AND coalesce(sl.product_name,'') NOT ILIKE 'Dummy:%'
    ORDER BY sl.created_at DESC
    LIMIT 100
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO _buys
  FROM (
    SELECT
      e.id,
      e.user_id,
      e.catalog_product_id,
      e.channel,
      e.metadata,
      e.created_at,
      c.product_name,
      c.retailer,
      c.audience,
      c.price,
      c.currency,
      c.product_url,
      c.image_path
    FROM public.shopper_events e
    LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
    WHERE e.user_id = _id AND e.event_type = 'buy_click'
      AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
    ORDER BY e.created_at DESC
    LIMIT 100
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO _shares
  FROM (
    SELECT
      e.id,
      e.user_id,
      e.catalog_product_id,
      e.channel,
      e.metadata,
      e.created_at,
      c.product_name,
      c.retailer,
      c.audience,
      c.price,
      c.currency,
      c.product_url,
      c.image_path
    FROM public.shopper_events e
    LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
    WHERE e.user_id = _id AND e.event_type = 'share_click'
      AND coalesce(e.metadata->>'seed','') <> 'admin_panel_dummy'
    ORDER BY e.created_at DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object(
    'email', _email,
    'user', _profile,
    'looks', _looks,
    'saves', _saves,
    'buys', _buys,
    'shares', _shares
  );
END;
$$;
