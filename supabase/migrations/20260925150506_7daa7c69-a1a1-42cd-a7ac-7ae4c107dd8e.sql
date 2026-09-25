CREATE POLICY "shoplook_media_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'shoplook-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "shoplook_media_read_own" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'shoplook-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "shoplook_media_update_own" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'shoplook-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
) WITH CHECK (
  bucket_id = 'shoplook-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "shoplook_media_delete_own" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'shoplook-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);