CREATE TABLE public.wardrobe_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 name text NOT NULL,
 category text NOT NULL DEFAULT 'Other',
 image_path text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT wardrobe_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
 CONSTRAINT wardrobe_owned_path CHECK (image_path LIKE user_id::text || '/wardrobe/%')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wardrobe_items TO authenticated;
GRANT ALL ON public.wardrobe_items TO service_role;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY wardrobe_owner ON public.wardrobe_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wardrobe_user_created ON public.wardrobe_items(user_id, created_at DESC);