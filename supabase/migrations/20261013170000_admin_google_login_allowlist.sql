-- Switch admin auth to Google allowlist (no password login).
ALTER TABLE public.admin_users
  ALTER COLUMN password_hash DROP NOT NULL;

UPDATE public.admin_users
SET password_hash = NULL
WHERE password_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_login(_email text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Password login disabled. Use Google sign-in.' USING ERRCODE = '28000';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_login_google()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _admin public.admin_users;
  _session public.admin_sessions;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.email INTO _email
  FROM auth.users u
  WHERE u.id = _uid
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL;

  IF _email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = _uid
      AND i.provider = 'google'
  ) THEN
    RAISE EXCEPTION 'Google sign-in required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO _admin
  FROM public.admin_users
  WHERE email = lower(btrim(_email));

  IF _admin.id IS NULL THEN
    RAISE EXCEPTION 'Not an admin' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.admin_sessions (admin_id, expires_at)
  VALUES (_admin.id, now() + interval '12 hours')
  RETURNING * INTO _session;

  RETURN jsonb_build_object(
    'token', _session.token,
    'email', _admin.email,
    'expiresAt', _session.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login_google() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_login_google() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_login_google() TO authenticated, service_role;
