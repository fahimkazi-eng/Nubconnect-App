-- ============================================================================
-- NUBCONNECT — Real social feed (Phase 5)
-- Migration: 010_real_feed.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Migration 002 turned RLS on for `posts` but never wrote a policy for it, so
-- the table has been deny-all: the app could not read or write a single post.
-- `post_media` went the other way — RLS was never enabled, so every row in it
-- was readable and writable by anyone holding the anon key.
--
-- This migration gives the feed a real backend:
--   • posts        — read within your university, write your own posts
--   • post_media   — photos readable with the post, writable only by its author
--   • comments     — students can comment on posts they can see
--   • notifications — a new post reaches your followers, a comment or reaction
--                     reaches the author
--   • storage      — a `post-media` bucket for post photographs
--
-- It is additive and non-destructive: no row is deleted or rewritten, and the
-- demo dataset still backs every surface when no backend is configured.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Can this viewer see this post?
--    One definition of "visible", shared by posts, their photos and their
--    comments.
--
--    The rule is expressed over a post's own fields rather than by re-reading
--    the row: Postgres re-checks the SELECT policy for rows an INSERT returns,
--    and a row inserted by the very same statement is not yet visible to the
--    statement's snapshot. A helper that looked the row up would therefore
--    reject its own insert ("new row violates row-level security policy").
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_is_visible(
  p_author_id       UUID,
  p_university_id   UUID,
  p_visibility      TEXT,
  p_department_id   UUID,
  p_organization_id UUID,
  p_is_hidden       BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  viewer_uni   UUID;
  viewer_dept  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Your own post is always yours to see, even while it is hidden.
  IF p_author_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  IF p_is_hidden IS TRUE THEN
    RETURN FALSE;
  END IF;

  SELECT uu.university_id INTO viewer_uni
    FROM public.user_universities uu
   WHERE uu.user_id = auth.uid()
   LIMIT 1;

  IF viewer_uni IS NULL OR viewer_uni <> p_university_id THEN
    RETURN FALSE;
  END IF;

  IF p_visibility = 'university' THEN
    RETURN TRUE;
  END IF;

  IF p_visibility = 'department' THEN
    SELECT p.department_id INTO viewer_dept
      FROM public.profiles p
     WHERE p.id = auth.uid();
    RETURN viewer_dept IS NOT NULL AND viewer_dept = p_department_id;
  END IF;

  IF p_visibility = 'organization' THEN
    RETURN EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.user_id = auth.uid()
         AND om.organization_id = p_organization_id
         AND om.membership_status = 'approved'
    );
  END IF;

  RETURN FALSE;
END
$$;

-- The same rule for callers that only know a post id.
CREATE OR REPLACE FUNCTION public.can_view_post(target_post UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_row posts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO target_row FROM public.posts WHERE id = target_post;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN public.post_is_visible(
    target_row.author_id,
    target_row.university_id,
    target_row.visibility,
    target_row.department_id,
    target_row.organization_id,
    target_row.is_hidden
  );
END
$$;

REVOKE ALL ON FUNCTION public.post_is_visible(UUID, UUID, TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_is_visible(UUID, UUID, TEXT, UUID, UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.can_view_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Posts
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can read posts they are allowed to see" ON public.posts;
CREATE POLICY "Students can read posts they are allowed to see"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (public.post_is_visible(
    author_id, university_id, visibility, department_id, organization_id, is_hidden
  ));

DROP POLICY IF EXISTS "Students can publish their own posts" ON public.posts;
CREATE POLICY "Students can publish their own posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    -- A student post is always a student post. Official and club content is
    -- published by staff through the control centre, never from the app.
    AND content_origin = 'student_created'
    AND university_id IN (
      SELECT uu.university_id
        FROM public.user_universities uu
       WHERE uu.user_id = auth.uid()
    )
    AND (department_id IS NULL OR department_id = (
      SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid()
    ))
    AND (organization_id IS NULL OR EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.user_id = auth.uid()
         AND om.organization_id = posts.organization_id
         AND om.membership_status = 'approved'
    ))
    AND body <> ''
  );

DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
CREATE POLICY "Authors can update their own posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    -- Editing must not let a student promote a post to official content.
    AND content_origin = 'student_created'
  );

DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.posts;
CREATE POLICY "Authors can delete their own posts"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Post photos
--    RLS was never enabled here, so every row was readable and writable by the
--    anon key. It is enabled now, and writes are limited to the post's author.
-- ----------------------------------------------------------------------------
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read photos on posts they can see" ON public.post_media;
CREATE POLICY "Students can read photos on posts they can see"
  ON public.post_media
  FOR SELECT
  TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Authors can attach photos to their own posts" ON public.post_media;
CREATE POLICY "Authors can attach photos to their own posts"
  ON public.post_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    media_type = 'image'
    AND EXISTS (
      SELECT 1 FROM public.posts p
       WHERE p.id = post_media.post_id
         AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can remove photos from their own posts" ON public.post_media;
CREATE POLICY "Authors can remove photos from their own posts"
  ON public.post_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
       WHERE p.id = post_media.post_id
         AND p.author_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Comments
--    The read policy was `true`, so every comment in the database was readable
--    by any signed-in student, including comments on hidden posts.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "University members can read comments" ON public.comments;
CREATE POLICY "University members can read comments"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Students can comment on posts they can see" ON public.comments;
CREATE POLICY "Students can comment on posts they can see"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_post(post_id)
    AND body <> ''
  );

-- ----------------------------------------------------------------------------
-- 5. Post photographs (storage)
--    Post photos are campus photographs and are public to read, like avatars
--    and covers. Writes are confined to the owner's own folder.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Post photographs are publicly readable" ON storage.objects;
CREATE POLICY "Post photographs are publicly readable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Students can upload their own post photographs" ON storage.objects;
CREATE POLICY "Students can upload their own post photographs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Students can replace their own post photographs" ON storage.objects;
CREATE POLICY "Students can replace their own post photographs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Students can delete their own post photographs" ON storage.objects;
CREATE POLICY "Students can delete their own post photographs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- 6. Reaction counts
--    A student may read their own reaction rows, but not everybody's — so the
--    counts are computed by the database. Counts are social proof, not a
--    list of names: this function never returns who reacted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_post_reaction_counts(p_posts UUID[])
RETURNS TABLE (
  post_id        UUID,
  reaction_type  TEXT,
  reaction_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.post_id, r.reaction_type, count(*)::int
    FROM public.reactions r
    JOIN public.posts p ON p.id = r.post_id
   WHERE r.post_id = ANY (p_posts)
     AND public.post_is_visible(
           p.author_id, p.university_id, p.visibility, p.department_id, p.organization_id, p.is_hidden
         )
   GROUP BY r.post_id, r.reaction_type;
$$;

REVOKE ALL ON FUNCTION public.get_post_reaction_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_counts(UUID[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. Notifications
--    A post reaches the author's followers; a comment or reaction reaches the
--    post's author. Written by the database, so the app cannot forge one.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_post_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author  UUID;
  post_title   TEXT;
  actor_name   TEXT;
  actor_id     UUID := auth.uid();
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    post_author := NEW.author_id;
    post_title := left(NEW.body, 80);
    -- The author is the actor here: the followers are the ones to tell.
    INSERT INTO public.notifications (user_id, category, title, body, action_route)
    SELECT f.follower_id,
           'social',
           'Someone you follow posted',
           left(NEW.body, 120),
           '/home'
      FROM public.follows f
     WHERE f.target_type = 'profile'
       AND f.target_id = post_author
       AND f.follower_id <> post_author;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'comments' THEN
    SELECT p.author_id, left(p.body, 80)
      INTO post_author, post_title
      FROM public.posts p
     WHERE p.id = NEW.post_id;

    IF post_author IS NOT NULL AND actor_id IS NOT NULL AND actor_id <> post_author THEN
      SELECT pr.display_name INTO actor_name
        FROM public.profiles pr
       WHERE pr.id = actor_id;

      INSERT INTO public.notifications (user_id, category, title, body, action_route)
      VALUES (
        post_author,
        'social',
        coalesce(actor_name, 'Someone') || ' commented on your post',
        left(NEW.body, 120),
        '/home'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'reactions' THEN
    SELECT p.author_id, left(p.body, 80)
      INTO post_author, post_title
      FROM public.posts p
     WHERE p.id = NEW.post_id;

    IF post_author IS NOT NULL AND actor_id IS NOT NULL AND actor_id <> post_author THEN
      SELECT pr.display_name INTO actor_name
        FROM public.profiles pr
       WHERE pr.id = actor_id;

      INSERT INTO public.notifications (user_id, category, title, body, action_route)
      VALUES (
        post_author,
        'social',
        coalesce(actor_name, 'Someone') || ' reacted to your post',
        'Reaction: ' || NEW.reaction_type,
        '/home'
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS notify_followers_of_new_post ON public.posts;
CREATE TRIGGER notify_followers_of_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_activity();

DROP TRIGGER IF EXISTS notify_post_author_of_comment ON public.comments;
CREATE TRIGGER notify_post_author_of_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_activity();

DROP TRIGGER IF EXISTS notify_post_author_of_reaction ON public.reactions;
CREATE TRIGGER notify_post_author_of_reaction
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_activity();

REVOKE ALL ON FUNCTION public.notify_post_activity() FROM PUBLIC;
