-- Authenticated shoppers must be able to log look_created (wardrobe + client fallback).
-- Previously only look_saved / buy_click / share_click were allowed, so generations never appeared in admin.

DROP POLICY IF EXISTS shopper_events_insert_own ON public.shopper_events;

CREATE POLICY shopper_events_insert_own
ON public.shopper_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_type = 'auth'
  AND user_id = auth.uid()
  AND (
    event_type = ANY (ARRAY['look_saved'::text, 'buy_click'::text, 'share_click'::text])
    OR (
      event_type = 'look_created'
      AND look_image_path IS NOT NULL
      AND look_image_path LIKE (auth.uid()::text || '/%')
    )
  )
);

-- Catch saves that never got a matching look_created row (generation logging was missing).
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
