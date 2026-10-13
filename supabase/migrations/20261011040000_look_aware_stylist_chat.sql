-- Conversation shell + look-aware message rows for one stylist chat per account.
CREATE TABLE IF NOT EXISTS public.stylist_conversations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  active_saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  active_session_image_path text,
  active_product_name text,
  active_comment text,
  CONSTRAINT stylist_conversations_active_product_name_len
    CHECK (active_product_name IS NULL OR char_length(active_product_name) <= 500),
  CONSTRAINT stylist_conversations_active_comment_len
    CHECK (active_comment IS NULL OR char_length(active_comment) <= 500),
  CONSTRAINT stylist_conversations_active_session_path_len
    CHECK (active_session_image_path IS NULL OR char_length(active_session_image_path) <= 500)
);

ALTER TABLE public.stylist_conversations
  ADD COLUMN IF NOT EXISTS active_saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_session_image_path text,
  ADD COLUMN IF NOT EXISTS active_product_name text,
  ADD COLUMN IF NOT EXISTS active_comment text;

CREATE TABLE IF NOT EXISTS public.stylist_messages (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_look_id uuid REFERENCES public.saved_looks(id) ON DELETE SET NULL,
  session_image_path text,
  product_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT stylist_messages_parts_is_array CHECK (jsonb_typeof(parts) = 'array'),
  CONSTRAINT stylist_messages_product_name_len
    CHECK (product_name IS NULL OR char_length(product_name) <= 500),
  CONSTRAINT stylist_messages_comment_len
    CHECK (comment IS NULL OR char_length(comment) <= 500),
  CONSTRAINT stylist_messages_session_path_len
    CHECK (session_image_path IS NULL OR char_length(session_image_path) <= 500)
);

CREATE INDEX IF NOT EXISTS stylist_messages_user_created_idx
  ON public.stylist_messages (user_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_conversations TO authenticated;
GRANT ALL ON public.stylist_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_messages TO authenticated;
GRANT ALL ON public.stylist_messages TO service_role;

ALTER TABLE public.stylist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stylist_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stylist_conversation_owner ON public.stylist_conversations;
CREATE POLICY stylist_conversation_owner ON public.stylist_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS stylist_messages_owner ON public.stylist_messages;
CREATE POLICY stylist_messages_owner ON public.stylist_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO public.stylist_messages (id, user_id, role, parts, session_image_path, product_name, comment, created_at)
SELECT
  COALESCE(NULLIF(msg->>'id', ''), gen_random_uuid()::text) AS id,
  c.user_id,
  CASE WHEN msg->>'role' = 'assistant' THEN 'assistant' ELSE 'user' END AS role,
  CASE
    WHEN jsonb_typeof(msg->'parts') = 'array' THEN msg->'parts'
    ELSE '[]'::jsonb
  END AS parts,
  NULLIF(msg->'metadata'->>'imagePath', '') AS session_image_path,
  NULLIF(msg->'metadata'->>'productName', '') AS product_name,
  NULLIF(msg->'metadata'->>'comment', '') AS comment,
  c.updated_at + (ordinality * interval '1 millisecond') AS created_at
FROM public.stylist_conversations c
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(c.messages) = 'array' THEN c.messages ELSE '[]'::jsonb END
) WITH ORDINALITY AS t(msg, ordinality)
WHERE msg->>'role' IN ('user', 'assistant')
ON CONFLICT (user_id, id) DO NOTHING;

UPDATE public.stylist_conversations SET messages = '[]'::jsonb WHERE messages IS DISTINCT FROM '[]'::jsonb;
