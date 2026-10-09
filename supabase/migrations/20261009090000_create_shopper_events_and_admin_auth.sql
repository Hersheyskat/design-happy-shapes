CREATE TABLE public.shopper_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('look_created', 'look_saved', 'buy_click', 'share_click')),
  actor_type text NOT NULL CHECK (actor_type IN ('auth', 'guest')),
  user_id uuid,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  channel text CHECK (channel IS NULL OR char_length(channel) BETWEEN 1 AND 40),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((actor_type = 'guest' AND user_id IS NULL) OR (actor_type = 'auth' AND user_id IS NOT NULL)),
  CHECK (event_type = 'look_created' OR actor_type = 'auth')
);

CREATE INDEX shopper_events_type_created_idx ON public.shopper_events (event_type, created_at DESC);
CREATE INDEX shopper_events_actor_created_idx ON public.shopper_events (actor_type, created_at DESC);
CREATE INDEX shopper_events_user_created_idx ON public.shopper_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;

GRANT INSERT ON public.shopper_events TO authenticated;
GRANT ALL ON public.shopper_events TO service_role;
ALTER TABLE public.shopper_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY shopper_events_insert_own ON public.shopper_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_type = 'auth'
    AND user_id = auth.uid()
    AND event_type IN ('look_saved', 'buy_click', 'share_click')
  );
CREATE POLICY shopper_events_service_all ON public.shopper_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$' AND char_length(email) <= 120),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_sessions_admin_idx ON public.admin_sessions (admin_id);
CREATE INDEX admin_sessions_expires_idx ON public.admin_sessions (expires_at);

GRANT ALL ON public.admin_users TO service_role;
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_users_service_all ON public.admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY admin_sessions_service_all ON public.admin_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.admin_users (email, password_hash)
VALUES ('thekathuria@gmail.com', extensions.crypt('admin@admin', extensions.gen_salt('bf', 10)));

CREATE OR REPLACE FUNCTION public.admin_login(_email text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _admin public.admin_users;
  _session public.admin_sessions;
BEGIN
  IF _email IS NULL OR _password IS NULL OR char_length(_password) < 1 OR char_length(_password) > 72 THEN
    RAISE EXCEPTION 'Invalid email or password' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO _admin
  FROM public.admin_users
  WHERE email = lower(btrim(_email));
  IF _admin.id IS NULL OR _admin.password_hash <> crypt(_password, _admin.password_hash) THEN
    RAISE EXCEPTION 'Invalid email or password' USING ERRCODE = '28000';
  END IF;
  INSERT INTO public.admin_sessions (admin_id, expires_at)
  VALUES (_admin.id, now() + interval '7 days')
  RETURNING * INTO _session;
  RETURN jsonb_build_object(
    'token', _session.token,
    'email', _admin.email,
    'expiresAt', _session.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_logout(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_sessions WHERE token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_session(_token uuid)
RETURNS jsonb
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
  RETURN jsonb_build_object('email', _email);
END;
$$;

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

  RETURN jsonb_build_object(
    'email', _email,
    'looks', _looks,
    'saves', _saves,
    'buys', _buys,
    'shares', _shares
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_logout(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_logout(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_session(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_dashboard(uuid) TO anon, authenticated, service_role;
