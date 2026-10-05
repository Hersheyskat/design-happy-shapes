CREATE OR REPLACE FUNCTION public.claim_ai_generation_cooldown(_client_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _claimed boolean;
BEGIN
  IF char_length(_client_hash) <> 64 THEN RAISE EXCEPTION 'Invalid client hash'; END IF;
  INSERT INTO public.ai_generation_cooldowns(client_hash, last_generated_at) VALUES (_client_hash, now())
  ON CONFLICT (client_hash) DO UPDATE SET last_generated_at = now()
    WHERE ai_generation_cooldowns.last_generated_at <= now() - interval '3 seconds'
  RETURNING true INTO _claimed;
  RETURN coalesce(_claimed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ai_generation_cooldown(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_generation_cooldown(text) TO service_role;