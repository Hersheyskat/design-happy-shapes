CREATE OR REPLACE FUNCTION public.admin_list_activity(
  _token uuid,
  _kind text,
  _search text DEFAULT '',
  _actor text DEFAULT NULL,
  _channel text DEFAULT NULL,
  _published boolean DEFAULT NULL,
  _range text DEFAULT 'all',
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
  _page_size int;
  _page_offset int;
  _sort_key text;
  _sort_dir text;
  _rows jsonb;
  _total int;
  _channels jsonb;
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

  _from := CASE coalesce(_range, 'all')
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE NULL
  END;

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
        lower(coalesce(p.display_name, p.handle, p.first_name, '')) AS person_sort
      FROM public.saved_looks sl
      LEFT JOIN public.profiles p ON p.id = sl.user_id
      WHERE (_from IS NULL OR sl.created_at >= _from)
        AND (_published IS NULL OR sl.is_published = _published)
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
        c.product_name,
        c.retailer,
        c.audience,
        c.price,
        c.currency,
        c.product_url,
        c.retailer AS product_retailer,
        c.price AS product_price,
        c.currency AS product_currency,
        NULL::text AS mood,
        NULL::text AS headline,
        NULL::text AS summary,
        NULL::boolean AS is_published,
        lower(coalesce(p.display_name, p.handle, p.first_name, '')) AS person_sort
      FROM public.shopper_events e
      LEFT JOIN public.profiles p ON p.id = e.user_id
      LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
      WHERE e.event_type = CASE _kind
          WHEN 'look' THEN 'look_created'
          WHEN 'buy' THEN 'buy_click'
          ELSE 'share_click'
        END
        AND (_from IS NULL OR e.created_at >= _from)
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

REVOKE ALL ON FUNCTION public.admin_list_activity(uuid, text, text, text, text, boolean, text, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_activity(uuid, text, text, text, text, boolean, text, text, text, int, int) TO anon, authenticated, service_role;
