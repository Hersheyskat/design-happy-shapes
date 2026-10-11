CREATE TABLE public.stylist_conversations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  active_saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  active_session_image_path text,
  active_product_name text,
  active_comment text
);
CREATE TABLE public.stylist_messages (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  session_image_path text,
  product_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX stylist_messages_user_created_idx ON public.stylist_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_conversations TO authenticated;
GRANT ALL ON public.stylist_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_messages TO authenticated;
GRANT ALL ON public.stylist_messages TO service_role;
ALTER TABLE public.stylist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stylist_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY stylist_conversation_owner ON public.stylist_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY stylist_messages_owner ON public.stylist_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
