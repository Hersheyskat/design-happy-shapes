CREATE OR REPLACE FUNCTION public.guest_look_remaining(_ip_hash text, _max_count integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (timezone('Asia/Kolkata', now()))::date;
  _count integer;
  _last timestamptz;
BEGIN
  IF char_length(_ip_hash) <> 64 THEN RAISE EXCEPTION 'Invalid client hash'; END IF;
  IF _max_count < 1 OR _max_count > 20 THEN RAISE EXCEPTION 'Invalid max count'; END IF;

  SELECT generation_count, last_generated_at
    INTO _count, _last
  FROM public.guest_look_quotas
  WHERE ip_hash = _ip_hash;

  IF _count IS NULL THEN
    RETURN _max_count;
  END IF;

  IF (_last AT TIME ZONE 'Asia/Kolkata')::date < _today THEN
    RETURN _max_count;
  END IF;

  RETURN greatest(_max_count - _count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.guest_look_remaining(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_look_remaining(text, integer) TO service_role;
