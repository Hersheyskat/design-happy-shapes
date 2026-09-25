CREATE POLICY "shoplook_media_read_published" ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'shoplook-media'
  AND EXISTS (
    SELECT 1 FROM public.saved_looks l
    WHERE l.is_published
      AND NOT l.is_removed
      AND (l.shopper_image_path = name OR l.product_image_path = name)
  )
);