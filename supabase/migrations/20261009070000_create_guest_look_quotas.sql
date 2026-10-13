CREATE TABLE public.guest_look_quotas (
  ip_hash text PRIMARY KEY CHECK (char_length(ip_hash) = 64),
  generation_count integer NOT NULL DEFAULT 0 CHECK (generation_count >= 0 AND generation_count <= 10000),
  last_generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.guest_look_quotas TO service_role;
ALTER TABLE public.guest_look_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_look_quotas_service_only" ON public.guest_look_quotas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER guest_look_quotas_updated_at BEFORE UPDATE ON public.guest_look_quotas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_guest_look_generation(_ip_hash text, _max_count integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _remaining integer;
BEGIN
  IF char_length(_ip_hash) <> 64 THEN RAISE EXCEPTION 'Invalid client hash'; END IF;
  IF _max_count < 1 OR _max_count > 20 THEN RAISE EXCEPTION 'Invalid max count'; END IF;
  INSERT INTO public.guest_look_quotas(ip_hash, generation_count, last_generated_at)
  VALUES (_ip_hash, 1, now())
  ON CONFLICT (ip_hash) DO UPDATE
    SET generation_count = guest_look_quotas.generation_count + 1,
        last_generated_at = now()
    WHERE guest_look_quotas.generation_count < _max_count
  RETURNING (_max_count - generation_count) INTO _remaining;
  RETURN coalesce(_remaining, -1);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_guest_look_generation(_ip_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(_ip_hash) <> 64 THEN RAISE EXCEPTION 'Invalid client hash'; END IF;
  UPDATE public.guest_look_quotas
    SET generation_count = generation_count - 1
    WHERE ip_hash = _ip_hash AND generation_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_look_generation(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_look_generation(text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_guest_look_generation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_guest_look_generation(text) TO service_role;
