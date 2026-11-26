-- ============================================================================
-- NUBCONNECT — Campus Pulse 2.0
-- Migration: 012_campus_pulse.sql
--
-- WHY THIS EXISTS
-- ---------------
-- The tables for live presence and group activities already exist, but they
-- cannot express what Campus Pulse is supposed to be:
--
--   • "Online on the app", "physically on campus" and "available to talk"
--     are three different things, and one column cannot carry all three.
--     A separate self-reported check-in is added, so being signed in never
--     implies being on campus.
--   • A student must be able to choose who sees their availability.
--   • An activity must support "open joining" as well as "request to join".
--   • Availability and activity categories must be administrable without a
--     code change — and they must never invent an official campus map.
--   • The pulse has to update live, so the tables join the realtime
--     publication instead of being polled.
--
-- Additive only: no row is deleted or rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Admin-managed directories
--    Campus areas are configured by staff from the admin panel. Nothing is
--    seeded: an official campus map is not ours to invent.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pulse_campus_areas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pulse_campus_areas_university_slug_key UNIQUE (university_id, slug)
);

CREATE TABLE IF NOT EXISTS public.pulse_activity_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pulse_activity_categories_university_slug_key UNIQUE (university_id, slug)
);

-- ----------------------------------------------------------------------------
-- 2. Availability: a check-in is not an availability status
-- ----------------------------------------------------------------------------
ALTER TABLE public.campus_now_statuses
  ADD COLUMN IF NOT EXISTS status_key TEXT,
  ADD COLUMN IF NOT EXISTS on_campus BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campus_area_id UUID REFERENCES public.pulse_campus_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'university',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_now_statuses_visibility_check'
  ) THEN
    ALTER TABLE public.campus_now_statuses
      ADD CONSTRAINT campus_now_statuses_visibility_check
      CHECK (visibility IN ('university', 'verified_only', 'circles', 'private'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS campus_now_statuses_expires_idx
  ON public.campus_now_statuses(expires_at);

-- The legacy `activity` column was limited to six labels (Studying, Free, …).
-- Campus Pulse stores the chosen status in `status_key` and keeps `activity`
-- as a readable label, so the narrow list would reject every new status.
ALTER TABLE public.campus_now_statuses
  DROP CONSTRAINT IF EXISTS campus_now_statuses_activity_check;

-- ----------------------------------------------------------------------------
-- 3. Activities: description, cover, join mode and meeting area
-- ----------------------------------------------------------------------------
ALTER TABLE public.activity_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS join_mode TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS campus_area_id UUID REFERENCES public.pulse_campus_areas(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_plans_join_mode_check'
  ) THEN
    ALTER TABLE public.activity_plans
      ADD CONSTRAINT activity_plans_join_mode_check
      CHECK (join_mode IN ('open', 'request'));
  END IF;
END
$$;

-- Activity categories used to be a hard-coded five. Campus Pulse offers a
-- wider, product-defined vocabulary (and administrators may add to it through
-- pulse_activity_categories), so the constraint is widened rather than left to
-- silently reject a coffee break.
ALTER TABLE public.activity_plans DROP CONSTRAINT IF EXISTS activity_plans_category_check;
ALTER TABLE public.activity_plans
  ADD CONSTRAINT activity_plans_category_check
  CHECK (
    category IN (
      'Study', 'Sports', 'Food', 'Event', 'Errand',
      'coffee_break', 'study_session', 'football', 'photography_walk',
      'gaming', 'lunch_group', 'campus_exploration', 'casual_hangout'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Join requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_plan_requests (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id    UUID NOT NULL REFERENCES public.activity_plans(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT activity_plan_requests_plan_user_key UNIQUE (plan_id, user_id),
  CONSTRAINT activity_plan_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE INDEX IF NOT EXISTS activity_plan_requests_plan_idx
  ON public.activity_plan_requests(plan_id);

-- ----------------------------------------------------------------------------
-- 5. Availability that respects the chosen audience
--    The university audience is everyone; verified_only narrows to verified
--    students; circles narrows to the viewer's communities; private means
--    only the student themself.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_see_availability(target_user UUID, target_visibility TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  viewer_uni      UUID;
  viewer_verified BOOLEAN;
  shared_circle   BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF target_user = auth.uid() THEN
    RETURN TRUE;
  END IF;

  IF target_visibility = 'private' THEN
    RETURN FALSE;
  END IF;

  SELECT uu.university_id INTO viewer_uni
    FROM public.user_universities uu
   WHERE uu.user_id = auth.uid()
   LIMIT 1;

  IF viewer_uni IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(p.is_verified_student, false) INTO viewer_verified
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF target_visibility = 'verified_only' AND NOT viewer_verified THEN
    RETURN FALSE;
  END IF;

  IF target_visibility = 'circles' THEN
    -- Circles the two students share, through any group.
    SELECT EXISTS (
      SELECT 1
        FROM public.community_groups g
       WHERE g.university_id = viewer_uni
         AND EXISTS (
           SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
         )
         AND EXISTS (
           SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = g.id AND gm.user_id = target_user
         )
    ) INTO shared_circle;

    RETURN COALESCE(shared_circle, false);
  END IF;

  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.can_see_availability(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_availability(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "University members can read live campus-now statuses" ON public.campus_now_statuses;
CREATE POLICY "University members can read live campus-now statuses"
  ON public.campus_now_statuses
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND public.can_see_availability(user_id, visibility)
    AND EXISTS (
      SELECT 1 FROM public.user_universities uu
       WHERE uu.user_id = auth.uid()
         AND uu.university_id = campus_now_statuses.university_id
    )
  );

DROP POLICY IF EXISTS "Students can post only their own campus-now status" ON public.campus_now_statuses;
CREATE POLICY "Students can post only their own campus-now status"
  ON public.campus_now_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.user_universities uu
       WHERE uu.user_id = auth.uid()
         AND uu.university_id = campus_now_statuses.university_id
    )
  );

DROP POLICY IF EXISTS "Students can update only their own campus-now status" ON public.campus_now_statuses;
CREATE POLICY "Students can update only their own campus-now status"
  ON public.campus_now_statuses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND expires_at > now()
  );

-- ----------------------------------------------------------------------------
-- 6. Directories, requests and join requests
-- ----------------------------------------------------------------------------
ALTER TABLE public.pulse_campus_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_plan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active campus areas are readable" ON public.pulse_campus_areas;
CREATE POLICY "Active campus areas are readable"
  ON public.pulse_campus_areas
  FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS "Administrators manage campus areas" ON public.pulse_campus_areas;
CREATE POLICY "Administrators manage campus areas"
  ON public.pulse_campus_areas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  );

DROP POLICY IF EXISTS "Active activity categories are readable" ON public.pulse_activity_categories;
CREATE POLICY "Active activity categories are readable"
  ON public.pulse_activity_categories
  FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS "Administrators manage activity categories" ON public.pulse_activity_categories;
CREATE POLICY "Administrators manage activity categories"
  ON public.pulse_activity_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  );

DROP POLICY IF EXISTS "Students can read join requests for an activity" ON public.activity_plan_requests;
CREATE POLICY "Students can read join requests for an activity"
  ON public.activity_plan_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_plans p
       WHERE p.id = activity_plan_requests.plan_id
         AND EXISTS (
           SELECT 1 FROM public.user_universities uu
            WHERE uu.user_id = auth.uid()
              AND uu.university_id = p.university_id
         )
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can request to join an activity" ON public.activity_plan_requests;
CREATE POLICY "Students can request to join an activity"
  ON public.activity_plan_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.activity_plans p
       WHERE p.id = activity_plan_requests.plan_id
         AND p.status = 'open'
         AND EXISTS (
           SELECT 1 FROM public.user_universities uu
            WHERE uu.user_id = auth.uid()
              AND uu.university_id = p.university_id
         )
    )
  );

DROP POLICY IF EXISTS "Activity hosts can decide join requests" ON public.activity_plan_requests;
CREATE POLICY "Activity hosts can decide join requests"
  ON public.activity_plan_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_plans p
       WHERE p.id = activity_plan_requests.plan_id
         AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'accepted', 'declined')
  );

-- ----------------------------------------------------------------------------
-- 7. Joining an activity
--    Open activities can be joined directly. An activity that asks for
--    requests needs the host's decision first.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_activity(p_plan UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_row   public.activity_plans%ROWTYPE;
  joined     BOOLEAN := false;
BEGIN
  SELECT * INTO plan_row FROM public.activity_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF plan_row.status <> 'open' THEN
    RETURN false;
  END IF;

  IF plan_row.join_mode = 'request' THEN
    -- Requests are the host's decision, not the student's.
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_universities uu
     WHERE uu.user_id = auth.uid() AND uu.university_id = plan_row.university_id
  ) THEN
    RETURN false;
  END IF;

  -- The participant limit is respected: a full activity is not joinable.
  IF plan_row.participant_limit > 0
     AND (SELECT count(*) FROM public.activity_plan_participants WHERE plan_id = p_plan) >= plan_row.participant_limit
     AND NOT EXISTS (
       SELECT 1 FROM public.activity_plan_participants
        WHERE plan_id = p_plan AND user_id = auth.uid()
     ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.activity_plan_participants (plan_id, user_id)
  VALUES (p_plan, auth.uid())
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS joined = ROW_COUNT;
  RETURN joined;
END
$$;

REVOKE ALL ON FUNCTION public.join_activity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_activity(UUID) TO authenticated;

-- A host cannot insert another student's participant row directly (and should
-- not be able to): accepting a request is a single server-side decision.
CREATE OR REPLACE FUNCTION public.decide_activity_request(p_request UUID, p_accept BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_row  public.activity_plan_requests%ROWTYPE;
  plan_row public.activity_plans%ROWTYPE;
BEGIN
  SELECT * INTO req_row FROM public.activity_plan_requests WHERE id = p_request;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO plan_row FROM public.activity_plans WHERE id = req_row.plan_id;
  IF NOT FOUND OR plan_row.created_by <> auth.uid() THEN
    RETURN false;
  END IF;

  IF plan_row.status <> 'open' THEN
    RETURN false;
  END IF;

  IF p_accept
     AND plan_row.participant_limit > 0
     AND (SELECT count(*) FROM public.activity_plan_participants WHERE plan_id = plan_row.id) >= plan_row.participant_limit
     AND NOT EXISTS (
       SELECT 1 FROM public.activity_plan_participants
        WHERE plan_id = plan_row.id AND user_id = req_row.user_id
     ) THEN
    RETURN false;
  END IF;

  UPDATE public.activity_plan_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         decided_at = now(),
         decided_by = auth.uid()
   WHERE id = p_request;

  IF p_accept THEN
    INSERT INTO public.activity_plan_participants (plan_id, user_id)
    VALUES (plan_row.id, req_row.user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.decide_activity_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_activity_request(UUID, BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "Students can join plans themselves" ON public.activity_plan_participants;
CREATE POLICY "Students can join plans themselves"
  ON public.activity_plan_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. Live updates
--    The pulse joins the realtime publication, so availability and activity
--    changes arrive without polling.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'campus_now_statuses',
    'activity_plans',
    'activity_plan_participants',
    'activity_plan_requests'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 9. Housekeeping
--    Expired availability is invisible to the application already; this
--    removes the stale rows so the table stays honest.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_availability()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.campus_now_statuses WHERE expires_at <= now() - INTERVAL '12 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

REVOKE ALL ON FUNCTION public.expire_stale_availability() FROM PUBLIC;
