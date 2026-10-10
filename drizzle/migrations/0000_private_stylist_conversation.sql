CREATE TABLE public.stylist_conversations (
  user_id uuid PRIMARY KEY,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_conversations TO authenticated;
GRANT ALL ON public.stylist_conversations TO service_role;
ALTER TABLE public.stylist_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stylist_conversation_owner ON public.stylist_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);