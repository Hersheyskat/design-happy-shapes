CREATE OR REPLACE FUNCTION public.claim_guest_look_generation(_ip_hash text, _max_count integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining integer;
  _today date := (timezone('Asia/Kolkata', now()))::date;
BEGIN
  IF char_length(_ip_hash) <> 64 THEN RAISE EXCEPTION 'Invalid client hash'; END IF;
  IF _max_count < 1 OR _max_count > 20 THEN RAISE EXCEPTION 'Invalid max count'; END IF;

  INSERT INTO public.guest_look_quotas(ip_hash, generation_count, last_generated_at)
  VALUES (_ip_hash, 1, now())
  ON CONFLICT (ip_hash) DO UPDATE
    SET generation_count = CASE
          WHEN (guest_look_quotas.last_generated_at AT TIME ZONE 'Asia/Kolkata')::date < _today THEN 1
          ELSE guest_look_quotas.generation_count + 1
        END,
        last_generated_at = now()
    WHERE (guest_look_quotas.last_generated_at AT TIME ZONE 'Asia/Kolkata')::date < _today
       OR guest_look_quotas.generation_count < _max_count
  RETURNING (_max_count - generation_count) INTO _remaining;

  RETURN coalesce(_remaining, -1);
END;
$$;
