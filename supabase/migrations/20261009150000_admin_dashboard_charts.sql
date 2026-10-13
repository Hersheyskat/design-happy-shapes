CREATE OR REPLACE FUNCTION public.admin_dashboard(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _looks jsonb;
  _saves jsonb;
  _buys jsonb;
  _shares jsonb;
  _charts jsonb;
BEGIN
  SELECT u.email INTO _email
  FROM public.admin_sessions s
  JOIN public.admin_users u ON u.id = s.admin_id
  WHERE s.token = _token AND s.expires_at > now();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Admin session expired' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*)::int,
    'auth', count(*) FILTER (WHERE actor_type = 'auth')::int,
    'guest', count(*) FILTER (WHERE actor_type = 'guest')::int,
    'recent', coalesce((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT e.id, e.actor_type, e.user_id, e.catalog_product_id, e.channel, e.metadata, e.created_at,
               p.handle, p.display_name, p.first_name, p.surname,
               c.product_name, c.retailer, c.audience, c.price, c.currency
        FROM public.shopper_events e
        LEFT JOIN public.profiles p ON p.id = e.user_id
        LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
        WHERE e.event_type = 'look_created'
        ORDER BY e.created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb)
  ) INTO _looks FROM public.shopper_events WHERE event_type = 'look_created';

  SELECT jsonb_build_object(
    'total', (SELECT count(*)::int FROM public.saved_looks),
    'eventTotal', count(*)::int,
    'recent', coalesce((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT sl.id, sl.user_id, sl.product_name, sl.product_retailer, sl.product_price, sl.product_currency,
               sl.product_url, sl.mood, sl.headline, sl.summary, sl.is_published, sl.created_at,
               p.handle, p.display_name, p.first_name, p.surname
        FROM public.saved_looks sl
        LEFT JOIN public.profiles p ON p.id = sl.user_id
        ORDER BY sl.created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb)
  ) INTO _saves FROM public.shopper_events WHERE event_type = 'look_saved';

  SELECT jsonb_build_object(
    'total', count(*)::int,
    'recent', coalesce((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT e.id, e.user_id, e.catalog_product_id, e.channel, e.metadata, e.created_at,
               p.handle, p.display_name, p.first_name, p.surname,
               c.product_name, c.retailer, c.audience, c.price, c.currency, c.product_url
        FROM public.shopper_events e
        LEFT JOIN public.profiles p ON p.id = e.user_id
        LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
        WHERE e.event_type = 'buy_click'
        ORDER BY e.created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb)
  ) INTO _buys FROM public.shopper_events WHERE event_type = 'buy_click';

  SELECT jsonb_build_object(
    'total', count(*)::int,
    'byChannel', coalesce((
      SELECT jsonb_object_agg(channel, total)
      FROM (
        SELECT coalesce(channel, 'unknown') AS channel, count(*)::int AS total
        FROM public.shopper_events
        WHERE event_type = 'share_click'
        GROUP BY coalesce(channel, 'unknown')
      ) s
    ), '{}'::jsonb),
    'recent', coalesce((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT e.id, e.user_id, e.catalog_product_id, e.channel, e.metadata, e.created_at,
               p.handle, p.display_name, p.first_name, p.surname,
               c.product_name, c.retailer, c.audience, c.price, c.currency
        FROM public.shopper_events e
        LEFT JOIN public.profiles p ON p.id = e.user_id
        LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
        WHERE e.event_type = 'share_click'
        ORDER BY e.created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb)
  ) INTO _shares FROM public.shopper_events WHERE event_type = 'share_click';

  SELECT jsonb_build_object(
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'date', to_char(g.day::date, 'YYYY-MM-DD'),
        'looks', coalesce(c.looks, 0),
        'saves', coalesce(c.saves, 0),
        'buys', coalesce(c.buys, 0),
        'shares', coalesce(c.shares, 0)
      ) ORDER BY g.day)
      FROM generate_series(
        (timezone('utc', now()))::date - 29,
        (timezone('utc', now()))::date,
        interval '1 day'
      ) AS g(day)
      LEFT JOIN (
        SELECT (timezone('utc', created_at))::date AS day,
          count(*) FILTER (WHERE event_type = 'look_created')::int AS looks,
          count(*) FILTER (WHERE event_type = 'look_saved')::int AS saves,
          count(*) FILTER (WHERE event_type = 'buy_click')::int AS buys,
          count(*) FILTER (WHERE event_type = 'share_click')::int AS shares
        FROM public.shopper_events
        WHERE created_at >= ((timezone('utc', now()))::date - 29)
        GROUP BY 1
      ) c ON c.day = g.day::date
    ), '[]'::jsonb),
    'looksByActor', jsonb_build_array(
      jsonb_build_object(
        'name', 'Signed in',
        'value', (SELECT count(*)::int FROM public.shopper_events WHERE event_type = 'look_created' AND actor_type = 'auth')
      ),
      jsonb_build_object(
        'name', 'Guest',
        'value', (SELECT count(*)::int FROM public.shopper_events WHERE event_type = 'look_created' AND actor_type = 'guest')
      )
    ),
    'sharesByChannel', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', channel, 'value', total) ORDER BY total DESC, channel)
      FROM (
        SELECT coalesce(nullif(btrim(channel), ''), 'unknown') AS channel, count(*)::int AS total
        FROM public.shopper_events
        WHERE event_type = 'share_click'
        GROUP BY 1
      ) s
    ), '[]'::jsonb),
    'topProducts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'retailer', retailer,
        'looks', looks,
        'buys', buys,
        'total', looks + buys
      ) ORDER BY looks + buys DESC, name)
      FROM (
        SELECT coalesce(nullif(c.product_name, ''), 'Unknown product') AS name,
               coalesce(c.retailer, '') AS retailer,
               count(*) FILTER (WHERE e.event_type = 'look_created')::int AS looks,
               count(*) FILTER (WHERE e.event_type = 'buy_click')::int AS buys
        FROM public.shopper_events e
        LEFT JOIN public.catalog_products c ON c.id = e.catalog_product_id
        WHERE e.event_type IN ('look_created', 'buy_click')
          AND e.created_at >= ((timezone('utc', now()))::date - 29)
        GROUP BY 1, 2
        ORDER BY (count(*) FILTER (WHERE e.event_type = 'look_created') + count(*) FILTER (WHERE e.event_type = 'buy_click')) DESC, 1
        LIMIT 8
      ) p
    ), '[]'::jsonb)
  ) INTO _charts;

  RETURN jsonb_build_object(
    'email', _email,
    'looks', _looks,
    'saves', _saves,
    'buys', _buys,
    'shares', _shares,
    'charts', _charts
  );
END;
$$;
