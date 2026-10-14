-- Capture shopper input photo alongside generated look output for admin review.

ALTER TABLE public.shopper_events
  ADD COLUMN IF NOT EXISTS input_image_path text
  CHECK (input_image_path IS NULL OR char_length(input_image_path) BETWEEN 1 AND 500);

DROP POLICY IF EXISTS shopper_events_insert_own ON public.shopper_events;

CREATE POLICY shopper_events_insert_own
ON public.shopper_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_type = 'auth'
  AND user_id = auth.uid()
  AND (
    event_type = ANY (ARRAY['look_saved'::text, 'buy_click'::text, 'share_click'::text])
    OR (
      event_type = 'look_created'
      AND look_image_path IS NOT NULL
      AND look_image_path LIKE (auth.uid()::text || '/%')
      AND (
        input_image_path IS NULL
        OR input_image_path LIKE (auth.uid()::text || '/%')
      )
    )
  )
);

DROP POLICY IF EXISTS shoplook_media_read_look_events ON storage.objects;
CREATE POLICY shoplook_media_read_look_events
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'shoplook-media'
  AND EXISTS (
    SELECT 1
    FROM public.shopper_events e
    WHERE e.look_image_path = name
       OR e.input_image_path = name
  )
);

CREATE OR REPLACE FUNCTION public.admin_list_activity(
  _token uuid,
  _kind text,
  _search text DEFAULT '',
  _actor text DEFAULT NULL,
  _channel text DEFAULT NULL,
  _published boolean DEFAULT NULL,
  _range text DEFAULT 'all',
  _from_date date DEFAULT NULL,
  _to_date date DEFAULT NULL,
  _sort text DEFAULT 'created_at',
  _dir text DEFAULT 'desc',
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
  _from timestamptz;
  _until timestamptz;
  _page_size int;
  _page_offset int;
  _sort_key text;
  _sort_dir text;
  _rows jsonb;
  _total int;
  _channels jsonb;
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

  IF _kind IS NULL OR _kind NOT IN ('look', 'save', 'buy', 'share') THEN
    RAISE EXCEPTION 'Invalid activity kind' USING ERRCODE = '22023';
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
    WHEN 'product' THEN 'product'
    WHEN 'person' THEN 'person'
    WHEN 'retailer' THEN 'retailer'
    WHEN 'price' THEN 'price'
    WHEN 'channel' THEN 'channel'
    WHEN 'actor' THEN 'actor'
    WHEN 'published' THEN 'published'
    ELSE 'created_at'
  END;
  _sort_dir := CASE WHEN lower(coalesce(_dir, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;

  IF _kind = 'save' THEN
    WITH filtered AS (
      SELECT
        sl.id,
        'auth'::text AS actor_type,
        sl.user_id,
        sl.catalog_product_id,
        NULL::text AS channel,
        jsonb_build_object('mood', sl.mood, 'headline', sl.headline) AS metadata,
        sl.created_at,
        p.handle,
        p.display_name,
        p.first_name,
        p.surname,
        au.email,
        true AS is_registered,
        sl.product_name,
        sl.product_retailer AS retailer,
        NULL::text AS audience,
        sl.product_price AS price,
        sl.product_currency AS currency,
        sl.product_url,
        sl.product_retailer,
        sl.product_price,
        sl.product_currency,
        sl.mood,
        sl.headline,
        sl.summary,
        sl.is_published,
        NULL::text AS input_image_path,
        sl.shopper_image_path AS image_path,
        lower(coalesce(p.display_name, p.handle, p.first_name, au.email, '')) AS person_sort
      FROM public.saved_looks sl
      LEFT JOIN public.profiles p ON p.id = sl.user_id
      LEFT JOIN auth.users au ON au.id = sl.user_id
      WHERE (_from IS NULL OR sl.created_at >= _from)
        AND (_until IS NULL OR sl.created_at < _until)
        AND (_published IS NULL OR sl.is_published = _published)
        AND coalesce(sl.product_name, '') NOT ILIKE 'Dummy:%'
        AND (
          _q = ''
          OR coalesce(sl.product_name, '') ILIKE '%' || _q || '%'
          OR coalesce(sl.product_retailer, '') ILIKE '%' || _q || '%'
          OR coalesce(sl.headline, '') ILIKE '%' || _q || '%'
          OR coalesce(sl.mood, '') ILIKE '%' || _q || '%'
          OR coalesce(p.handle, '') ILIKE '%' || _q || '%'
          OR coalesce(p.display_name, '') ILIKE '%' || _q || '%'
          OR coalesce(p.first_name, '') ILIKE '%' || _q || '%'
          OR coalesce(p.surname, '') ILIKE '%' || _q || '%'
          OR coalesce(au.email, '') ILIKE '%' || _q || '%'
        )
    )
    SELECT
      count(*)::int,
      coalesce((
        SELECT jsonb_agg(to_jsonb(r) - 'person_sort' - 'seq' ORDER BY r.seq)
        FROM (
          SELECT
            f.*,
            row_number() OVER () AS seq
          FROM (
            SELECT *
            FROM filtered src
            ORDER BY
              CASE WHEN _sort_key = 'product' AND _sort_dir = 'asc' THEN src.product_name END ASC NULLS LAST,
              CASE WHEN _sort_key = 'product' AND _sort_dir = 'desc' THEN src.product_name END DESC NULLS LAST,
              CASE WHEN _sort_key = 'person' AND _sort_dir = 'asc' THEN src.person_sort END ASC NULLS LAST,
              CASE WHEN _sort_key = 'person' AND _sort_dir = 'desc' THEN src.person_sort END DESC NULLS LAST,
              CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'asc' THEN src.retailer END ASC NULLS LAST,
              CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'desc' THEN src.retailer END DESC NULLS LAST,
              CASE WHEN _sort_key = 'price' AND _sort_dir = 'asc' THEN src.price END ASC NULLS LAST,
              CASE WHEN _sort_key = 'price' AND _sort_dir = 'desc' THEN src.price END DESC NULLS LAST,
              CASE WHEN _sort_key = 'published' AND _sort_dir = 'asc' THEN src.is_published::int END ASC NULLS LAST,
              CASE WHEN _sort_key = 'published' AND _sort_dir = 'desc' THEN src.is_published::int END DESC NULLS LAST,
              CASE WHEN _sort_dir = 'asc' THEN src.created_at END ASC,
              CASE WHEN _sort_dir = 'desc' THEN src.created_at END DESC,
              src.created_at DESC
            LIMIT _page_size OFFSET _page_offset
          ) f
        ) r
      ), '[]'::jsonb)
    INTO _total, _rows
    FROM filtered;
  ELSE
    WITH filtered AS (
      SELECT
        e.id,
        e.actor_type,
        e.user_id,
        e.catalog_product_id,
        e.channel,
        e.metadata,
        e.created_at,
        p.handle,
        p.display_name,
        p.first_name,
        p.surname,
        au.email,
        (e.actor_type = 'auth') AS is_registered,
        coalesce(c.product_name, e.metadata->>'product_name') AS product_name,
        coalesce(c.retailer, e.metadata->>'retailer') AS retailer,
        c.audience,
        c.price,
        c.currency,
        c.product_url,
        coalesce(c.retailer, e.metadata->>'retailer') AS product_retailer,
        c.price AS product_price,
        c.currency AS product_currency,
        NULL::text AS mood,
        NULL::text AS headline,
        NULL::text AS summary,
        NULL::boolean AS is_published,
        CASE WHEN _kind = 'look' THEN e.input_image_path ELSE NULL::text END AS input_image_path,
        CASE
          WHEN _kind = 'look' THEN coalesce(e.look_image_path, c.image_path)
          ELSE c.image_path
        END AS image_path,
        lower(coalesce(p.display_name, p.handle, p.first_name, au.email, '')) AS person_sort
      FROM public.shopper_events e
      LEFT JOIN public.profiles p ON p.id = e.user_id
      LEFT JOIN auth.users au ON au.id = e.user_id
      LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
      WHERE e.event_type = CASE _kind
          WHEN 'look' THEN 'look_created'
          WHEN 'buy' THEN 'buy_click'
          ELSE 'share_click'
        END
        AND coalesce(e.metadata->>'seed', '') <> 'admin_panel_dummy'
        AND (_from IS NULL OR e.created_at >= _from)
        AND (_until IS NULL OR e.created_at < _until)
        AND (_actor IS NULL OR _actor = 'all' OR e.actor_type = _actor)
        AND (_channel IS NULL OR _channel = '' OR e.channel = _channel)
        AND (
          _q = ''
          OR coalesce(c.product_name, '') ILIKE '%' || _q || '%'
          OR coalesce(c.retailer, '') ILIKE '%' || _q || '%'
          OR coalesce(e.channel, '') ILIKE '%' || _q || '%'
          OR coalesce(p.handle, '') ILIKE '%' || _q || '%'
          OR coalesce(p.display_name, '') ILIKE '%' || _q || '%'
          OR coalesce(p.first_name, '') ILIKE '%' || _q || '%'
          OR coalesce(p.surname, '') ILIKE '%' || _q || '%'
          OR coalesce(au.email, '') ILIKE '%' || _q || '%'
          OR coalesce(e.metadata::text, '') ILIKE '%' || _q || '%'
        )
    )
    SELECT
      count(*)::int,
      coalesce((
        SELECT jsonb_agg(to_jsonb(r) - 'person_sort' - 'seq' ORDER BY r.seq)
        FROM (
          SELECT
            f.*,
            row_number() OVER () AS seq
          FROM (
            SELECT *
            FROM filtered src
            ORDER BY
              CASE WHEN _sort_key = 'product' AND _sort_dir = 'asc' THEN src.product_name END ASC NULLS LAST,
              CASE WHEN _sort_key = 'product' AND _sort_dir = 'desc' THEN src.product_name END DESC NULLS LAST,
              CASE WHEN _sort_key = 'person' AND _sort_dir = 'asc' THEN src.person_sort END ASC NULLS LAST,
              CASE WHEN _sort_key = 'person' AND _sort_dir = 'desc' THEN src.person_sort END DESC NULLS LAST,
              CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'asc' THEN src.retailer END ASC NULLS LAST,
              CASE WHEN _sort_key = 'retailer' AND _sort_dir = 'desc' THEN src.retailer END DESC NULLS LAST,
              CASE WHEN _sort_key = 'price' AND _sort_dir = 'asc' THEN src.price END ASC NULLS LAST,
              CASE WHEN _sort_key = 'price' AND _sort_dir = 'desc' THEN src.price END DESC NULLS LAST,
              CASE WHEN _sort_key = 'channel' AND _sort_dir = 'asc' THEN src.channel END ASC NULLS LAST,
              CASE WHEN _sort_key = 'channel' AND _sort_dir = 'desc' THEN src.channel END DESC NULLS LAST,
              CASE WHEN _sort_key = 'actor' AND _sort_dir = 'asc' THEN src.actor_type END ASC NULLS LAST,
              CASE WHEN _sort_key = 'actor' AND _sort_dir = 'desc' THEN src.actor_type END DESC NULLS LAST,
              CASE WHEN _sort_dir = 'asc' THEN src.created_at END ASC,
              CASE WHEN _sort_dir = 'desc' THEN src.created_at END DESC,
              src.created_at DESC
            LIMIT _page_size OFFSET _page_offset
          ) f
        ) r
      ), '[]'::jsonb)
    INTO _total, _rows
    FROM filtered;
  END IF;

  SELECT coalesce(jsonb_agg(channel ORDER BY channel), '[]'::jsonb)
  INTO _channels
  FROM (
    SELECT DISTINCT coalesce(channel, 'unknown') AS channel
    FROM public.shopper_events
    WHERE event_type = 'share_click'
  ) s;

  RETURN jsonb_build_object(
    'email', _email,
    'kind', _kind,
    'total', coalesce(_total, 0),
    'limit', _page_size,
    'offset', _page_offset,
    'rows', coalesce(_rows, '[]'::jsonb),
    'channels', coalesce(_channels, '[]'::jsonb)
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
      e.input_image_path,
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
