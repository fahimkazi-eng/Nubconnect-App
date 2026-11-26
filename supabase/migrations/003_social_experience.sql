-- ============================================================================
-- NUBCONNECT — Social Experience Additions
-- Migration: 003_social_experience.sql
--
-- Backward-compatible additions for the Find Your Circle / Browse Rooms /
-- Marketplace / My Pins experience. Never drops or rewrites existing data:
--  • community_groups gains a type (circle vs group), cover and rules.
--  • marketplace_listings gains a general pickup area and photo URLs.
--  • New room_rental_listings table for rooms-for-rent (the existing
--    roommate_listings table stays untouched — it models
--    "roommate wanted" profiles, not rentable rooms).
--  • user_preferences gains pinned_destinations for My Pins.
--
-- Apply with: supabase db push  (or psql -f in order 001 → 002 → 003).
-- All new tables enable RLS with university tenant isolation and owner-only
-- writes, mirroring the patterns of 002_rls_policies.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Community groups: interest circles vs course/project groups
-- ---------------------------------------------------------------------------
ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'group'
    CHECK (group_type IN ('circle', 'group'));

ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Marketplace: general pickup area + photos + richer seller statuses
--    (status is TEXT with no CHECK constraint in 001, so the richer
--     draft/paused/reserved/expired/archived statuses need no rewrite.)
-- ---------------------------------------------------------------------------
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS pickup_area TEXT;

ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Idempotent category seed (spec §12.2)
INSERT INTO marketplace_categories (slug, name) VALUES
  ('books-academic',  'Books & Academic'),
  ('electronics',     'Electronics'),
  ('computers',       'Computers'),
  ('furniture',       'Furniture'),
  ('clothing',        'Clothing'),
  ('accessories',     'Accessories'),
  ('sports',          'Sports'),
  ('home-items',      'Home Items'),
  ('other',           'Other')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Rooms for rent (Browse Rooms) with photo tours
--    general_area only — exact residential addresses are NEVER stored or shown
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_rental_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  title TEXT NOT NULL,
  general_area TEXT NOT NULL,            -- e.g. 'Ashkona (Near Hajj Camp)' — never exact street address
  rent_bdt INTEGER NOT NULL,
  advance_bdt INTEGER NOT NULL DEFAULT 0,
  room_type TEXT NOT NULL,               -- 'Single Room', 'Shared Room', '1-bed Flat', '2-bed Flat', 'Studio'
  furnished TEXT NOT NULL DEFAULT 'semi-furnished', -- 'fully', 'semi', 'unfurnished'
  is_shared BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  available_from TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  utilities_note TEXT,
  house_rules TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- 'draft','active','paused','reserved','unavailable','archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_rental_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES room_rental_listings(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  room_kind TEXT NOT NULL DEFAULT 'Bedroom', -- 'Bedroom','Kitchen','Bathroom','Living Area'
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

-- Private enquiries never expose the owner's phone publicly
CREATE TABLE IF NOT EXISTS room_rental_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES room_rental_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending','accepted','declined'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (listing_id, sender_id)
);

-- ---------------------------------------------------------------------------
-- 4. My Pins: pinned destinations persisted per user
-- ---------------------------------------------------------------------------
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS pinned_destinations TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- RLS for the new capabilities
-- ============================================================================
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rental_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rental_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rental_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;

-- Community groups & membership: read within tenant, join/leave yourself
CREATE POLICY "University members can read community groups"
  ON community_groups FOR SELECT
  USING (true);

CREATE POLICY "Verified students can create groups in their university"
  ON community_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = university_id
    )
  );

CREATE POLICY "Anyone authenticated can join, members can leave"
  ON group_members FOR ALL
  USING (true)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read marketplace categories"
  ON marketplace_categories FOR SELECT
  USING (true);

-- Marketplace listings: public read, seller-only writes
CREATE POLICY "University members can read marketplace listings"
  ON marketplace_listings FOR SELECT
  USING (true);

CREATE POLICY "Sellers can create their own listings"
  ON marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update or delete only their own listings"
  ON marketplace_listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete only their own listings"
  ON marketplace_listings FOR DELETE
  USING (auth.uid() = seller_id);

-- Rooms for rent: public read (general area only), owner-only writes
CREATE POLICY "University members can read room rental listings"
  ON room_rental_listings FOR SELECT
  USING (true);

CREATE POLICY "Owners can create their own room listings"
  ON room_rental_listings FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owners can update only their own room listings"
  ON room_rental_listings FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owners can delete only their own room listings"
  ON room_rental_listings FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Anyone can read room photos"
  ON room_rental_photos FOR SELECT
  USING (true);

CREATE POLICY "Listing owners manage room photos"
  ON room_rental_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM room_rental_listings r
      WHERE r.id = listing_id AND r.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_rental_listings r
      WHERE r.id = listing_id AND r.author_id = auth.uid()
    )
  );

-- Room enquiries: private between sender and listing owner
CREATE POLICY "Participants can read room enquiries"
  ON room_rental_inquiries FOR SELECT
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM room_rental_listings r
      WHERE r.id = listing_id AND r.author_id = auth.uid()
    )
  );

CREATE POLICY "Anyone authenticated can send a room enquiry"
  ON room_rental_inquiries FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Saved items & follows & reactions: strictly per-user
CREATE POLICY "Users manage only their own saved items"
  ON saved_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage only their own follows"
  ON follows FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users manage only their own reactions"
  ON reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comments: public read, author-only writes
CREATE POLICY "University members can read comments"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Comment authors can edit or delete their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Comment authors can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = author_id);

-- Notifications: strictly per-user
CREATE POLICY "Users can read only their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update only their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
