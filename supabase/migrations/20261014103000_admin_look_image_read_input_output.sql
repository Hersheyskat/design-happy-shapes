-- Admin uses the publishable key; it cannot SELECT shopper_events under RLS.
-- Signed URLs need a SECURITY DEFINER check for both input and output look images.

CREATE OR REPLACE FUNCTION public.shoplook_media_is_look_event_image(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopper_events e
    WHERE e.look_image_path = _name
       OR e.input_image_path = _name
  );
$$;

REVOKE ALL ON FUNCTION public.shoplook_media_is_look_event_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shoplook_media_is_look_event_image(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS shoplook_media_read_look_events ON storage.objects;
CREATE POLICY shoplook_media_read_look_events
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'shoplook-media'
  AND public.shoplook_media_is_look_event_image(name)
);
