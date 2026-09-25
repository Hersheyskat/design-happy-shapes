CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  avatar_path text,
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 240),
  style_preferences text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_read_own" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert_own" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete_own" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);
CREATE INDEX user_blocks_blocked_idx ON public.user_blocks (blocked_id);

CREATE TABLE public.saved_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shopper_image_path text NOT NULL,
  product_image_path text,
  product_url text CHECK (product_url IS NULL OR product_url ~ '^https://'),
  mood text NOT NULL CHECK (mood IN ('minimal','street','classic','romantic','sporty')),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 1 AND 120),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 600),
  colors jsonb NOT NULL CHECK (jsonb_typeof(colors) = 'array'),
  adjustments jsonb NOT NULL CHECK (jsonb_typeof(adjustments) = 'array'),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_published AND published_at IS NOT NULL) OR (NOT is_published))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_looks TO authenticated;
GRANT SELECT ON public.saved_looks TO anon;
GRANT ALL ON public.saved_looks TO service_role;
ALTER TABLE public.saved_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_looks_owner_read" ON public.saved_looks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_looks_public_read" ON public.saved_looks FOR SELECT TO anon, authenticated USING (is_published AND NOT is_removed AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id = auth.uid() AND b.blocked_id = user_id) OR (b.blocker_id = user_id AND b.blocked_id = auth.uid())));
CREATE POLICY "saved_looks_insert_own" ON public.saved_looks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_published AND NOT is_removed);
CREATE POLICY "saved_looks_update_own" ON public.saved_looks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_looks_delete_own" ON public.saved_looks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX saved_looks_user_created_idx ON public.saved_looks (user_id, created_at DESC);
CREATE INDEX saved_looks_published_idx ON public.saved_looks (published_at DESC) WHERE is_published AND NOT is_removed;
CREATE TRIGGER saved_looks_updated_at BEFORE UPDATE ON public.saved_looks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id uuid NOT NULL REFERENCES public.saved_looks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  search_term text NOT NULL CHECK (char_length(search_term) BETWEEN 1 AND 160),
  destination_url text NOT NULL CHECK (destination_url ~ '^https://'),
  source text NOT NULL CHECK (source IN ('submitted','suggested')),
  display_order smallint NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;
GRANT SELECT ON public.saved_items TO anon;
GRANT ALL ON public.saved_items TO service_role;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_items_owner_read" ON public.saved_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_items_public_read" ON public.saved_items FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.is_published AND NOT l.is_removed));
CREATE POLICY "saved_items_insert_own" ON public.saved_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.user_id = auth.uid()));
CREATE POLICY "saved_items_update_own" ON public.saved_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_items_delete_own" ON public.saved_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX saved_items_look_order_idx ON public.saved_items (look_id, display_order);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_public_read" ON public.follows FOR SELECT TO anon, authenticated USING (NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id = auth.uid() AND b.blocked_id IN (follower_id, following_id)) OR (b.blocked_id = auth.uid() AND b.blocker_id IN (follower_id, following_id))));
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id = follower_id AND b.blocked_id = following_id) OR (b.blocker_id = following_id AND b.blocked_id = follower_id)));
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX follows_following_idx ON public.follows (following_id, created_at DESC);

CREATE TABLE public.look_likes (
  look_id uuid NOT NULL REFERENCES public.saved_looks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (look_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.look_likes TO authenticated;
GRANT SELECT ON public.look_likes TO anon;
GRANT ALL ON public.look_likes TO service_role;
ALTER TABLE public.look_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_public_read" ON public.look_likes FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.is_published AND NOT l.is_removed));
CREATE POLICY "likes_insert_own" ON public.look_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.is_published AND NOT l.is_removed AND l.user_id <> auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.user_blocks b JOIN public.saved_looks l ON l.id = look_id WHERE (b.blocker_id = auth.uid() AND b.blocked_id = l.user_id) OR (b.blocker_id = l.user_id AND b.blocked_id = auth.uid())));
CREATE POLICY "likes_delete_own" ON public.look_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX look_likes_user_idx ON public.look_likes (user_id, created_at DESC);

CREATE TABLE public.look_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id uuid NOT NULL REFERENCES public.saved_looks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.look_comments TO authenticated;
GRANT SELECT ON public.look_comments TO anon;
GRANT ALL ON public.look_comments TO service_role;
ALTER TABLE public.look_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.look_comments FOR SELECT TO anon, authenticated USING (NOT is_removed AND EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.is_published AND NOT l.is_removed) AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id = auth.uid() AND b.blocked_id = user_id) OR (b.blocker_id = user_id AND b.blocked_id = auth.uid())));
CREATE POLICY "comments_insert_own" ON public.look_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_removed AND EXISTS (SELECT 1 FROM public.saved_looks l WHERE l.id = look_id AND l.is_published AND NOT l.is_removed) AND NOT EXISTS (SELECT 1 FROM public.user_blocks b JOIN public.saved_looks l ON l.id = look_id WHERE (b.blocker_id = auth.uid() AND b.blocked_id = l.user_id) OR (b.blocker_id = l.user_id AND b.blocked_id = auth.uid())));
CREATE POLICY "comments_update_own" ON public.look_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.look_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX look_comments_look_created_idx ON public.look_comments (look_id, created_at);
CREATE TRIGGER look_comments_updated_at BEFORE UPDATE ON public.look_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  look_id uuid REFERENCES public.saved_looks(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.look_comments(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','unsafe','misleading','other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(look_id, comment_id, profile_id) = 1)
);
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_read_own" ON public.community_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert_own" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND status = 'open');
CREATE UNIQUE INDEX community_reports_unique_open_look ON public.community_reports (reporter_id, look_id) WHERE look_id IS NOT NULL AND status = 'open';
CREATE UNIQUE INDEX community_reports_unique_open_comment ON public.community_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL AND status = 'open';
CREATE UNIQUE INDEX community_reports_unique_open_profile ON public.community_reports (reporter_id, profile_id) WHERE profile_id IS NOT NULL AND status = 'open';

CREATE OR REPLACE FUNCTION public.cleanup_relationships_after_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  DELETE FROM public.look_likes ll
  USING public.saved_looks l
  WHERE ll.look_id = l.id
    AND ((ll.user_id = NEW.blocker_id AND l.user_id = NEW.blocked_id)
      OR (ll.user_id = NEW.blocked_id AND l.user_id = NEW.blocker_id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER cleanup_relationships_on_block AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.cleanup_relationships_after_block();