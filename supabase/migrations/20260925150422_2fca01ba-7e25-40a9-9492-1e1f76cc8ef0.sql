REVOKE ALL ON FUNCTION public.cleanup_relationships_after_block() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_relationships_after_block() TO service_role;