-- Remove seeded demo noise and restore look_created rows from real saved looks.
-- Safe to re-run: deletes only demo seed markers / Dummy-named saves.

DELETE FROM public.shopper_events
WHERE coalesce(metadata->>'seed', '') = 'admin_panel_dummy';

DELETE FROM public.saved_looks
WHERE product_name ILIKE 'Dummy:%';

INSERT INTO public.shopper_events (
  event_type, actor_type, user_id, catalog_product_id, saved_look_id, look_image_path, metadata, created_at
)
SELECT
  'look_created',
  'auth',
  sl.user_id,
  sl.catalog_product_id,
  sl.id,
  sl.shopper_image_path,
  jsonb_build_object(
    'product_name', sl.product_name,
    'retailer', sl.product_retailer,
    'price', sl.product_price,
    'currency', sl.product_currency,
    'source', 'backfill_from_saved_look'
  ),
  sl.created_at
FROM public.saved_looks sl
WHERE sl.shopper_image_path IS NOT NULL
  AND coalesce(sl.product_name, '') NOT ILIKE 'Dummy:%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.shopper_events e
    WHERE e.event_type = 'look_created'
      AND e.user_id = sl.user_id
      AND e.look_image_path = sl.shopper_image_path
  );
