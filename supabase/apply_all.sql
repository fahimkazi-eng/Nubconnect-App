
-- GENERATED FILE — do not edit.
-- Rebuild with: node scripts/build-apply-all.mjs
--
-- NUBCONNECT schema bundle: every migration in dependency order, followed
-- by the verified Northern University Bangladesh tenant seed.
-- Safe to run on a fresh Supabase project. Re-running is safe: every part
-- is written to be idempotent and no part deletes production rows.

-- ============================================================
-- supabase/migrations/001_initial_schema.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Complete Multi-University Relational Schema (PostgreSQL / Supabase)
-- Migration: 001_initial_schema.sql
-- Covers all 52 tables across Core University, Users/RBAC, Organizations/Reconciliation,
-- Community, Events/Notices, Academic, Roommates, Marketplace/Lost&Found, Opportunities,
-- and Source Import / Moderation / Audit Logs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums for strict verification and content authenticity
CREATE TYPE verification_status_enum AS ENUM (
  'officially_verified',
  'department_verified',
  'recognized_organization',
  'student_led',
  'awaiting_verification',
  'inactive',
  'archived'
);

CREATE TYPE content_origin_enum AS ENUM (
  'official_university',
  'department_published',
  'verified_club',
  'recognized_organization',
  'student_created',
  'imported_unverified'
);

CREATE TYPE app_role_enum AS ENUM (
  'visitor',
  'registered_user',
  'verified_student',
  'club_member',
  'club_representative',
  'department_editor',
  'university_content_admin',
  'university_admin',
  'platform_super_admin'
);

CREATE TYPE semester_system_enum AS ENUM ('tri_semester', 'bi_semester');

-- ============================================================================
-- 1. CORE UNIVERSITY DATA (Multi-Tenant Foundation)
-- ============================================================================
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  tagline TEXT,
  official_website TEXT NOT NULL,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE university_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_student_email_domain BOOLEAN DEFAULT TRUE,
  is_official_web_domain BOOLEAN DEFAULT TRUE,
  UNIQUE(university_id, domain)
);

CREATE TABLE faculties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, slug)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  semester_system semester_system_enum NOT NULL DEFAULT 'tri_semester',
  description TEXT,
  official_website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  source_url TEXT NOT NULL,
  verification_status verification_status_enum NOT NULL DEFAULT 'officially_verified',
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, slug)
);

CREATE TABLE academic_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  degree_level TEXT NOT NULL, -- 'Undergraduate', 'Postgraduate', 'Diploma/0+3'
  credit_hours NUMERIC(5,1),
  duration_text TEXT,
  entry_requirements TEXT,
  source_url TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculty_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  qualifications TEXT,
  research_interests TEXT,
  official_email TEXT,
  official_profile_url TEXT,
  verification_status verification_status_enum NOT NULL DEFAULT 'awaiting_verification',
  last_verified_at TIMESTAMPTZ
);

CREATE TABLE academic_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  semester_name TEXT NOT NULL,
  semester_system semester_system_enum NOT NULL,
  event_type TEXT NOT NULL, -- 'classes', 'registration', 'midterm', 'final_exam', 'holiday', 'break', 'deadline'
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  applicable_departments TEXT[],
  source_url TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE academic_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  rule_category TEXT NOT NULL, -- 'grading_scale', 'evaluation_marks', 'registration', 'withdrawal', 'promotion'
  title TEXT NOT NULL,
  rule_payload JSONB NOT NULL,
  source_url TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campus_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  hours TEXT,
  contact_info TEXT,
  eligibility TEXT,
  official_url TEXT,
  verification_status verification_status_enum NOT NULL DEFAULT 'officially_verified',
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(university_id, slug)
);

-- ============================================================================
-- 2. USERS, VERIFICATION & ROLE-BASED ACCESS CONTROL
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  primary_university_id UUID REFERENCES universities(id),
  faculty_id UUID REFERENCES faculties(id),
  department_id UUID REFERENCES departments(id),
  program_id UUID REFERENCES academic_programs(id),
  semester_label TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  social_links JSONB DEFAULT '{}'::jsonb,
  is_verified_student BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL DEFAULT 'student', -- 'student', 'alumni', 'faculty', 'staff'
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, university_id)
);

CREATE TABLE student_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  verification_method TEXT NOT NULL, -- 'university_email', 'invite_code', 'manual_admin_review', 'document'
  institutional_email TEXT,
  student_id_hash TEXT,
  private_document_path TEXT, -- Stored in private bucket with strict retention policy
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  role app_role_enum NOT NULL DEFAULT 'registered_user',
  department_id UUID REFERENCES departments(id),
  granted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, university_id, role)
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role app_role_enum NOT NULL,
  permission_key TEXT NOT NULL,
  description TEXT,
  UNIQUE(role, permission_key)
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  profile_visibility TEXT NOT NULL DEFAULT 'university_only', -- 'public', 'university_only', 'verified_only'
  show_semester BOOLEAN DEFAULT TRUE,
  allow_direct_messages TEXT NOT NULL DEFAULT 'requests_only', -- 'verified_students', 'requests_only', 'none'
  notify_official_notices BOOLEAN DEFAULT TRUE,
  notify_events BOOLEAN DEFAULT TRUE,
  notify_club_updates BOOLEAN DEFAULT TRUE,
  notify_roommate_inquiries BOOLEAN DEFAULT TRUE,
  notify_academic_reminders BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================================================
-- 3. CLUBS, ORGANIZATIONS & DUPLICATE RECONCILIATION
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  about TEXT,
  category TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'university_wide', -- 'university_wide', 'department_specific'
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  verification_status verification_status_enum NOT NULL DEFAULT 'awaiting_verification',
  membership_open BOOLEAN DEFAULT TRUE,
  membership_requirements TEXT,
  official_website TEXT,
  facebook_page_url TEXT,
  facebook_group_url TEXT,
  public_contact_email TEXT,
  logo_url TEXT,
  cover_url TEXT,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, slug)
);

CREATE TABLE organization_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE organization_departments (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, department_id)
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  membership_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'alumni'
  motivation_note TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE organization_representatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  can_publish_notices BOOLEAN DEFAULT TRUE,
  can_manage_events BOOLEAN DEFAULT TRUE,
  can_review_applications BOOLEAN DEFAULT TRUE,
  approved_by_admin UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE organization_committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  member_name TEXT NOT NULL,
  session_term TEXT NOT NULL,
  is_verified_source BOOLEAN DEFAULT FALSE,
  source_url TEXT
);

CREATE TABLE organization_verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  evidence_urls TEXT[] NOT NULL,
  advisor_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_social_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  is_official_verified BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- 4. COMMUNITY, POSTS, GROUPS & CONSENT-BASED MESSAGING
-- ============================================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  content_origin content_origin_enum NOT NULL DEFAULT 'student_created',
  category TEXT NOT NULL DEFAULT 'discussion', -- 'discussion', 'study_group', 'opportunity', 'club_update', 'official_notice'
  title TEXT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'university', -- 'university', 'department', 'club_members'
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  alt_text TEXT
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'helpful', -- 'helpful', 'celebrate', 'support'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'user', 'department', 'organization'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, target_type, target_id)
);

CREATE TABLE community_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  name TEXT NOT NULL,
  cohort_or_semester TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  participant_one UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'request_pending', -- 'request_pending', 'active', 'declined', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_one, participant_two)
);

CREATE TABLE message_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_type TEXT, -- 'roommate_inquiry', 'study_partner', 'marketplace', 'direct'
  initial_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'post', 'comment', 'roommate_listing', 'marketplace_listing', 'user', 'organization'
  target_id TEXT NOT NULL,
  reason_category TEXT NOT NULL, -- 'scam_or_fraud', 'harassment', 'impersonation', 'spam', 'inaccurate_official_claim', 'privacy_violation'
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'under_review', 'resolved', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. EVENTS, NOTICES, NEWS, NOTIFICATIONS & SAVED ITEMS
-- ============================================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT,
  venue_or_format TEXT NOT NULL,
  cover_image_url TEXT,
  content_origin content_origin_enum NOT NULL,
  verification_status verification_status_enum NOT NULL,
  registration_open BOOLEAN DEFAULT TRUE,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_organizers (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_name TEXT NOT NULL,
  organizer_type TEXT NOT NULL,
  PRIMARY KEY (event_id, organizer_name)
);

CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE event_attendance (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL, -- 'academic', 'examination', 'institutional', 'admission', 'holiday'
  is_urgent BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  published_date DATE NOT NULL,
  expires_at DATE,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'official_website',
  verification_status verification_status_enum NOT NULL DEFAULT 'officially_verified',
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  published_date DATE NOT NULL,
  source_url TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_route TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'notice', 'event', 'club', 'post', 'resource', 'opportunity', 'roommate'
  item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- ============================================================================
-- 6. ACADEMIC PLANNER, COURSES, RESOURCES & STUDY GROUPS
-- ============================================================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  credit_hours NUMERIC(3,1) NOT NULL DEFAULT 3.0,
  UNIQUE(university_id, course_code)
);

CREATE TABLE course_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  semester_label TEXT NOT NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'Syllabus', 'Lecture Notes', 'Lab Manual', 'Reference Guide'
  contributor_id UUID REFERENCES profiles(id),
  attribution_note TEXT NOT NULL,
  license_declaration BOOLEAN NOT NULL DEFAULT TRUE,
  download_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  focus_topic TEXT NOT NULL,
  next_session_text TEXT,
  mode TEXT NOT NULL DEFAULT 'Hybrid (Library Group Study Area / Online)',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_group_members (
  study_group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (study_group_id, user_id)
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'Continuous Assessment', -- 'Continuous Assessment (30)', 'Mid-term (30)', 'Final Exam (40)'
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE personal_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'study_goal',
  due_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE class_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room_label TEXT
);

CREATE TABLE user_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  semester_label TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  credit_hours NUMERIC(3,1) NOT NULL,
  letter_grade TEXT NOT NULL,
  grade_point NUMERIC(3,2) NOT NULL
);

CREATE TABLE semester_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  semester_label TEXT NOT NULL,
  total_credits NUMERIC(4,1) NOT NULL,
  semester_gpa NUMERIC(3,2) NOT NULL,
  is_official_verified BOOLEAN DEFAULT FALSE -- Always FALSE for student self-calculations
);

-- ============================================================================
-- 7. PRIVACY-CONSCIOUS ROOMMATE DISCOVERY
-- ============================================================================
CREATE TABLE roommate_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  title TEXT NOT NULL,
  general_area TEXT NOT NULL, -- e.g., 'Ashkona (Near Hajj Camp)', 'Kawlar Bazar Area', 'Uttara Sector 1/4', 'Khilkhet / Nikunja-2' (Never exact street address!)
  budget_min_bdt INTEGER NOT NULL,
  budget_max_bdt INTEGER NOT NULL,
  move_in_period TEXT NOT NULL,
  room_type TEXT NOT NULL, -- 'Shared Room (2-Bed)', 'Single Private Room in Shared Flat'
  roommates_wanted INTEGER NOT NULL DEFAULT 1,
  show_semester BOOLEAN DEFAULT TRUE,
  semester_label TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'filled', 'withdrawn'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roommate_preferences (
  listing_id UUID PRIMARY KEY REFERENCES roommate_listings(id) ON DELETE CASCADE,
  smoking_policy TEXT NOT NULL DEFAULT 'Non-smoking only',
  study_schedule TEXT NOT NULL DEFAULT 'Quiet after 11 PM',
  cleanliness_level TEXT NOT NULL DEFAULT 'Organized & shared chores',
  guest_policy TEXT NOT NULL DEFAULT 'Daytime study guests with notice',
  meal_system TEXT NOT NULL DEFAULT 'Shared mess / Bua system'
);

CREATE TABLE roommate_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES roommate_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, sender_id)
);

-- ============================================================================
-- 8. MARKETPLACE, LOST & FOUND, AND OPPORTUNITIES
-- ============================================================================
CREATE TABLE marketplace_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL REFERENCES marketplace_categories(slug),
  title TEXT NOT NULL,
  price_bdt INTEGER NOT NULL,
  condition TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- 'available', 'sold', 'removed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lost_found_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- 'lost', 'found'
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  approximate_location TEXT NOT NULL,
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  verification_question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'claimed_resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lost_found_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proof_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunity_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL REFERENCES opportunity_categories(slug),
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  deadline DATE NOT NULL,
  application_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verification_status verification_status_enum NOT NULL DEFAULT 'officially_verified',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunity_saves (
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, user_id)
);

-- ============================================================================
-- 9. DATA SOURCES, IMPORT JOBS, DUPLICATE CANDIDATES & AUDIT LOGS
-- ============================================================================
CREATE TABLE content_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'official_website', 'department_portal', 'recognized_club_site'
  last_checked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'healthy'
);

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_discovered INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed'
);

CREATE TABLE imported_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  original_published_at DATE,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  verification_status verification_status_enum NOT NULL DEFAULT 'awaiting_verification',
  content_status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved_published', 'rejected_outdated'
  original_attachment_url TEXT,
  payload JSONB NOT NULL
);

CREATE TABLE duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  org_a_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_b_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  similarity_reason TEXT NOT NULL,
  recommended_action TEXT NOT NULL, -- 'keep_separate_department_scope', 'keep_separate_distinct_mission', 'merge_alias'
  resolution_status TEXT NOT NULL DEFAULT 'pending_admin_review',
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  moderator_id UUID NOT NULL REFERENCES profiles(id),
  action_taken TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  actor_role app_role_enum NOT NULL,
  action_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_record_id TEXT NOT NULL,
  reason TEXT,
  diff_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- supabase/migrations/002_rls_policies.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Row Level Security (RLS) & Backend Authorization Policies
-- Migration: 002_rls_policies.sql
-- Enforces strict university-level isolation, role-based mutation controls,
-- and private verification document protection.
-- ============================================================================

-- Helper functions for RBAC and Tenant Isolation
CREATE OR REPLACE FUNCTION public.user_has_role(target_uni UUID, allowed_roles app_role_enum[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND university_id = target_uni
      AND role = ANY(allowed_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_club_rep(target_org UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_representatives
    WHERE organization_id = target_org
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS across sensitive & tenant-scoped tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Student Verifications: Strictly private to the owner and University Admins
CREATE POLICY "Users can view only their own verification requests"
  ON student_verifications FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );

CREATE POLICY "Only University Admins can approve student verifications"
  ON student_verifications FOR UPDATE
  USING (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );

-- 2. Organizations: Club representatives can update club details but CANNOT change verification_status
CREATE POLICY "Public read for active university organizations"
  ON organizations FOR SELECT
  USING (true);

CREATE POLICY "Club reps can update description/events but not verification badge"
  ON organizations FOR UPDATE
  USING (
    public.is_club_rep(id)
    OR public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  )
  WITH CHECK (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
    OR (
      public.is_club_rep(id)
      AND verification_status = (SELECT o.verification_status FROM organizations o WHERE o.id = organizations.id)
    )
  );

-- 3. Academic Planner & GPA Records: Strictly isolated per student
CREATE POLICY "Students can only read and modify their own academic planner courses"
  ON user_courses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can only access their own GPA estimates"
  ON semester_records FOR ALL
  USING (auth.uid() = user_id AND is_official_verified = FALSE)
  WITH CHECK (auth.uid() = user_id AND is_official_verified = FALSE);

-- 4. Consent-Based Messaging: Blocked users cannot send message requests or messages
CREATE POLICY "Participants can view conversations unless blocked"
  ON conversations FOR SELECT
  USING (auth.uid() IN (participant_one, participant_two));

CREATE POLICY "Send message only in active conversations and when not blocked"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.status = 'active'
        AND auth.uid() IN (c.participant_one, c.participant_two)
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = c.participant_one AND b.blocked_id = c.participant_two)
             OR (b.blocker_id = c.participant_two AND b.blocked_id = c.participant_one)
        )
    )
  );

-- 5. Admin Audit Logs: Restricted strictly to University Administrators & Super Admins
CREATE POLICY "Only authorized admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  USING (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );

-- ============================================================
-- supabase/seed/seed_nub.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Verified Institutional Seed Data for Northern University Bangladesh
-- Source: https://www.nub.ac.bd/ (Verified 2026-10-31)
-- Never fabricates statistics, teacher bios, or unverified badges.
-- ============================================================================

INSERT INTO universities (id, slug, name, short_name, tagline, official_website, address, contact_email, contact_phone)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'nub',
  'Northern University Bangladesh',
  'NUB',
  'Knowledge for Innovation and Change',
  'https://www.nub.ac.bd/',
  '111/2 Kawlar Jame Mosjid Road, Ashkona, (Near Hajj Camp) Dakshinkhan, Dhaka-1230 (Permanent Campus: Ashiyan City Road)',
  'info@nub.ac.bd',
  '01755514661, 01755514650, Tel: 9821493-7'
);

-- Five Official Faculties from https://nub.ac.bd/academic/t3gwthgw/academic-programs
INSERT INTO faculties (id, university_id, slug, name, source_url, last_verified_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'science-engineering', 'Faculty of Science & Engineering', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-10-31T00:00:00Z'),
  ('f1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'business', 'Faculty of Business', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-10-31T00:00:00Z'),
  ('f1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'humanities-social-science', 'Faculty of Humanities & Social Science', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-10-31T00:00:00Z'),
  ('f1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'law', 'Faculty of Law', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-10-31T00:00:00Z'),
  ('f1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'health-science', 'Faculty of Health Science', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-10-31T00:00:00Z');

-- ============================================================
-- supabase/migrations/003_social_experience.sql
-- ============================================================

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

-- ============================================================
-- supabase/migrations/004_campus_orbit.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — CAMPUS ORBIT
-- Migration: 004_campus_orbit.sql
--
-- Backward-compatible, purely ADDITIVE migration for the Campus Orbit
-- experience. Never drops or rewrites existing data (apply over 001 → 003):
--  • activity_plans + participants      — Make a Plan (§6.1)
--  • campus_now_statuses                — Campus Now (§6.2): opt-in, auto-
--                                          expiring, NO location tracking
--  • campus_introductions               — Introductions (§6.3): mutual
--                                          consent, silent decline
--  • community_groups expiry columns    — Temporary Circles (§6.4)
--  • organization_members verify token   — digital membership cards (§7.6)
--  • campus_honours                      — Campus Honours (§9)
--  • user_preferences.show_in_honours    — honours opt-out (§9)
--
-- Note on plan group chats: the existing message_requests.context_type is
-- free-form TEXT; plan chats reuse it with context_type = 'activity_plan'
-- (no schema change required).
--
-- All new tables enable RLS with university tenant isolation and owner-only
-- writes, mirroring the patterns of 002_rls_policies.sql / 003.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make a Plan (§6.1): real-life meetups, 2–20 participants, public campus
--    spots only (meeting_spot is user-typed text; addresses are discouraged
--    by product copy and never geocoded).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Study', 'Sports', 'Food', 'Event', 'Errand')),
  meeting_spot TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  participant_limit INTEGER NOT NULL DEFAULT 5 CHECK (participant_limit BETWEEN 2 AND 20),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'full', 'cancelled', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_plan_participants (
  plan_id UUID NOT NULL REFERENCES activity_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_plans_upcoming
  ON activity_plans(university_id, starts_at)
  WHERE status = 'open';

-- The creator is always a participant (enforced by trigger-free convention:
-- applications insert the creator row in the same transaction).

-- ---------------------------------------------------------------------------
-- 2. Campus Now (§6.2): a single opt-in status per student. The spot is
--    free text ("Central Library — 3rd floor"); NO geolocation, IP or
--    coordinates are ever stored. Rows auto-expire — the read policy below
--    hides anything past expires_at, and a scheduled cleanup may prune them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_now_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity TEXT NOT NULL CHECK (activity IN ('Studying', 'Free', 'Eating', 'Walking', 'Club room', 'Gym')),
  spot_note TEXT NOT NULL,
  note TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- set to posted_at + 120 minutes on write
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id) -- one live status per student
);

CREATE INDEX IF NOT EXISTS idx_campus_now_active
  ON campus_now_statuses(university_id, expires_at);

-- ---------------------------------------------------------------------------
-- 3. Campus Introductions (§6.3): mutual-consent cards shown to ONE
--    recipient. Declining is silent — no notification row is ever created
--    for the other student (enforced by application flow, never by a
--    notification insert).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_introductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- who is introduced
  introduced_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- who sees the card
  basis TEXT NOT NULL, -- e.g. 'Same department', 'Both in Photography Circle'
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, introduced_to)
);

-- ---------------------------------------------------------------------------
-- 4. Temporary Circles (§6.4): community_groups gains an expiry and a
--    promotion timestamp. A group with expires_at in the past is hidden
--    unless made_permanent_at is set (members chose to keep it).
-- ---------------------------------------------------------------------------
ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS made_permanent_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 5. Club membership cards (§7.6): every approved organization member row
--    gets a random verification token. The token maps 1:1 to the public,
--    read-only /verify/{token} page which shows only what is printed on the
--    card. Revoking membership (status change) keeps the row but the page
--    resolves only approved members in the application layer.
-- ---------------------------------------------------------------------------
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS membership_verify_token TEXT;

-- Backfill existing members with distinct random tokens
UPDATE organization_members
  SET membership_verify_token = encode(gen_random_bytes(24), 'hex')
  WHERE membership_verify_token IS NULL;

-- New members always get one
ALTER TABLE organization_members
  ALTER COLUMN membership_verify_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_verify_token
  ON organization_members(membership_verify_token);

-- ---------------------------------------------------------------------------
-- 6. Campus Honours (§9): contribution points with transparent criteria.
--    Entries are verified by clubs/departments/university — students never
--    self-report. The RLS read policy enforces the opt-out at the data layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_honours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('Mentoring', 'Organizing', 'Community Help', 'Knowledge Sharing', 'Creative Contribution', 'Volunteering')
  ),
  title TEXT NOT NULL,
  detail TEXT,
  points INTEGER NOT NULL CHECK (points > 0),
  semester TEXT NOT NULL, -- e.g. 'Fall 2026'
  verified_by TEXT NOT NULL DEFAULT 'club', -- 'club', 'department', 'university'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_honours_person
  ON campus_honours(person_id, semester);

-- ---------------------------------------------------------------------------
-- 7. Honours opt-out (§9): default TRUE (visible); students can hide their
--    name from Campus Honours and the Top Campus Contributor at any time.
-- ---------------------------------------------------------------------------
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS show_in_honours BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- RLS for the new capabilities (mirrors 002 / 003 patterns)
-- ============================================================================
ALTER TABLE activity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_now_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_honours ENABLE ROW LEVEL SECURITY;

-- Make a Plan: tenant-isolated reads, creator-only writes, self join/leave
CREATE POLICY "University members can read plans"
  ON activity_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = activity_plans.university_id
    )
  );

CREATE POLICY "Students can create plans in their university"
  ON activity_plans FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = activity_plans.university_id
    )
  );

CREATE POLICY "Plan creators can update or cancel their own plans"
  ON activity_plans FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Plan creators can delete their own plans"
  ON activity_plans FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "University members can read plan participants"
  ON activity_plan_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_plans p
      JOIN user_universities uu ON uu.university_id = p.university_id
      WHERE p.id = plan_id AND uu.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can join plans themselves"
  ON activity_plan_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can leave plans themselves"
  ON activity_plan_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Campus Now: only LIVE statuses are readable (auto-expiry at the data
-- layer), writes are strictly your own row — one status per student.
CREATE POLICY "University members can read live campus-now statuses"
  ON campus_now_statuses FOR SELECT
  USING (
    expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = campus_now_statuses.university_id
    )
  );

CREATE POLICY "Students can post only their own campus-now status"
  ON campus_now_statuses FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = campus_now_statuses.university_id
    )
  );

CREATE POLICY "Students can update only their own campus-now status"
  ON campus_now_statuses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can clear only their own campus-now status"
  ON campus_now_statuses FOR DELETE
  USING (auth.uid() = user_id);

-- Introductions: strictly private to the recipient — nobody else (including
-- the introduced person) can see a pending card. Recipients decide alone.
CREATE POLICY "Students can read introductions addressed to them"
  ON campus_introductions FOR SELECT
  USING (auth.uid() = introduced_to);

CREATE POLICY "Students can request introductions for themselves"
  ON campus_introductions FOR INSERT
  WITH CHECK (auth.uid() = introduced_to);

CREATE POLICY "Recipients can accept or silently decline"
  ON campus_introductions FOR UPDATE
  USING (auth.uid() = introduced_to)
  WITH CHECK (auth.uid() = introduced_to);

-- Campus Honours: public read WITHIN the app, but the data layer itself
-- enforces the student opt-out (§9). No student-facing INSERT/UPDATE —
-- entries are verified by clubs/departments/university via the service role.
CREATE POLICY "Honours are visible unless the student opted out"
  ON campus_honours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_preferences up
      WHERE up.user_id = campus_honours.person_id
        AND (up.show_in_honours IS NULL OR up.show_in_honours)
    )
  );

-- ============================================================
-- supabase/migrations/005_campus_pulse.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — CAMPUS PULSE ("Who's on Campus?") + expressive reactions
-- Migration: 005_campus_pulse.sql
--
-- Backward-compatible, purely ADDITIVE migration (apply over 001 → 004).
-- Never drops or rewrites existing data:
--  • campus_now_statuses.open_to_connect — optional "Open to Connect" signal
--    on the voluntary, auto-expiring campus presence (§7)
--  • comment_reactions                   — reactions on comments (§8),
--    mirroring the posts.reactions contract (one per user per comment)
--
-- Vocabulary documentation (no constraint changes needed — these columns
-- are free-form TEXT by design since 001/004):
--  • reactions.reaction_type now stores the NUBCONNECT universal set:
--    'love', 'fire', 'lol', 'respect', 'amazing', 'support', 'inspired',
--    'proud' (one reaction per user per post, unchanged).
--  • comment_reactions.reaction_type uses the same universal set.
--  • event_registrations.status may hold 'interested' or 'going' for the
--    contextual Event actions (§8) alongside the existing 'registered'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Campus Now: "Open to Connect" — an opt-in, non-tracking signal that the
--    student is happy to be approached right now. FALSE by default; the row
--    still auto-expires via the 004 read policy (expires_at > NOW()).
--    No geolocation is ever involved.
-- ---------------------------------------------------------------------------
ALTER TABLE campus_now_statuses
  ADD COLUMN IF NOT EXISTS open_to_connect BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. Comment reactions (§8): one reaction per user per comment, same universal
--    vocabulary as posts.reactions. Public read (counts are visible to
--    everyone); writes strictly your own row — mirroring the reactions
--    policies from 003.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- universal set: love/fire/lol/respect/amazing/support/inspired/proud
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
  ON comment_reactions(comment_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comment reactions"
  ON comment_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users manage only their own comment reactions"
  ON comment_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- supabase/migrations/006_student_accounts.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Individual student accounts (Phase 2)
-- Migration: 006_student_accounts.sql
--
-- Additive only. Fixes the profiles table, which had RLS ENABLED in 002 but
-- no policies at all (deny-all), and wires the account-owned tables that the
-- auth experience needs:
--   • profiles        — read/write own row, privacy-aware reads, privilege guard
--   • user_preferences — owner-only read/write (privacy settings)
--   • student_verifications — students may request review (never self-approve)
--   • storage buckets  — avatars + covers, public read, owner-only writes
--   • new-user trigger — creates profile + preferences + tenant membership
--
-- Account ≠ NUB Verified: signing up creates a profile with
-- is_verified_student = FALSE. Verification is a separate, authorized review.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Profile additions
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ----------------------------------------------------------------------------
-- 2. Privacy-aware profile reads
-- A SECURITY DEFINER helper keeps the policy from recursively querying
-- profiles under RLS. It is read-only and exposes no data itself.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_profile(target_profile UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_uni        UUID;
  target_suspended  BOOLEAN;
  target_visibility TEXT;
  viewer_uni        UUID;
  viewer_verified   BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() = target_profile THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id, p.is_suspended
    INTO target_uni, target_suspended
    FROM public.profiles p
   WHERE p.id = target_profile;

  IF target_uni IS NULL AND target_suspended IS NULL THEN
    RETURN FALSE; -- no such profile
  END IF;

  IF COALESCE(target_suspended, FALSE) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.profile_visibility, 'university_only')
    INTO target_visibility
    FROM public.user_preferences up
   WHERE up.user_id = target_profile;

  target_visibility := COALESCE(target_visibility, 'university_only');

  IF target_visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id, p.is_verified_student
    INTO viewer_uni, viewer_verified
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF target_visibility = 'verified_only' THEN
    RETURN COALESCE(viewer_verified, FALSE);
  END IF;

  -- university_only (default)
  RETURN viewer_uni IS NOT NULL AND viewer_uni = target_uni;
END;
$$;

DROP POLICY IF EXISTS "Profiles are readable per privacy settings" ON profiles;
CREATE POLICY "Profiles are readable per privacy settings"
  ON profiles FOR SELECT
  USING (public.can_view_profile(id));

DROP POLICY IF EXISTS "Students can create their own profile" ON profiles;
CREATE POLICY "Students can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Students can update their own profile" ON profiles;
CREATE POLICY "Students can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 3. Privilege guard: a student may edit their own profile, but never grant
-- themselves NUB Verified status or lift a suspension. Only another
-- authorized actor (admin via the service role or an admin session updating
-- someone else's row) can change those columns.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    IF NEW.is_verified_student IS DISTINCT FROM OLD.is_verified_student THEN
      RAISE EXCEPTION 'NUB Verified status is granted only through an authorized review';
    END IF;
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'Suspension status can only be changed by university administrators';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- ----------------------------------------------------------------------------
-- 4. Privacy preferences — owner-only, always
-- ----------------------------------------------------------------------------
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own preferences" ON user_preferences;
CREATE POLICY "Users can read their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own preferences" ON user_preferences;
CREATE POLICY "Users can create their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. NUB Verified requests — students may submit, only admins may decide.
-- (002 already restricts SELECT to owner/admins and UPDATE to admins.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can request their own verification" ON student_verifications;
CREATE POLICY "Students can request their own verification"
  ON student_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ----------------------------------------------------------------------------
-- 6. Storage — avatars & covers
-- Public read (profile images are public); writes confined to the owner's
-- folder (<uid>/filename), enforced by the first path segment.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('covers',  'covers',  TRUE, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatar and cover images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar and cover images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'covers'));

DROP POLICY IF EXISTS "Users can upload their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can upload their own avatar or cover"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can replace their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can replace their own avatar or cover"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can delete their own avatar or cover"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 7. New auth user → profile, preferences, tenant membership, base role.
-- Runs as SECURITY DEFINER because auth.users is outside the public schema.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username     TEXT;
  final_username    TEXT;
  nub_uni           UUID;
  chosen_department UUID;
BEGIN
  base_username := lower(
    regexp_replace(
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        split_part(COALESCE(NEW.email, 'student'), '@', 1)
      ),
      '[^a-zA-Z0-9._-]', '', 'g'
    )
  );

  IF base_username IS NULL OR length(base_username) < 3 THEN
    base_username := 'student';
  END IF;

  final_username := left(base_username, 30);

  SELECT id INTO nub_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  BEGIN
    chosen_department := NULLIF(NEW.raw_user_meta_data->>'department_id', '')::uuid;
  EXCEPTION WHEN others THEN
    chosen_department := NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, username, display_name, primary_university_id, department_id)
    VALUES (
      NEW.id,
      final_username,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(COALESCE(NEW.email, 'Student'), '@', 1)
      ),
      nub_uni,
      chosen_department
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- The chosen username was already taken; keep it recognisable and add a
    -- short suffix derived from the auth UUID.
    final_username := left(base_username, 20) || '-' || left(replace(NEW.id::text, '-', ''), 8);
    INSERT INTO public.profiles (id, username, display_name, primary_university_id, department_id)
    VALUES (
      NEW.id,
      final_username,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(COALESCE(NEW.email, 'Student'), '@', 1)
      ),
      nub_uni,
      chosen_department
    )
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF nub_uni IS NOT NULL THEN
    INSERT INTO public.user_universities (user_id, university_id, membership_type, is_primary)
    VALUES (NEW.id, nub_uni, 'student', TRUE)
    ON CONFLICT (user_id, university_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (NEW.id, nub_uni, 'registered_user')
    ON CONFLICT (user_id, university_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- supabase/migrations/007_messaging.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Real conversations & messaging (Phase 3)
-- Migration: 007_messaging.sql
--
-- Additive only. Turns the Phase 1/2 chat UI into a real, private, consent-
-- based 1:1 messaging layer:
--   • conversations  — kind, requested_by, last_message_at, item context
--   • messages       — photo attachments + replies
--   • message_reactions / conversation_settings (pin, mute, archive)
--   • RLS for every conversation table (002 only had partial policies)
--   • SECURITY DEFINER RPCs for the consent flow, read receipts, reactions,
--     blocking and the inbox query
--   • private message-photos bucket, readable only by the two participants
--
-- Group/plan chats stay local to the current browser session until group
-- messaging ships; this migration intentionally models the real 1:1
-- conversation only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Conversation & message additions
-- ----------------------------------------------------------------------------
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context JSONB;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_kind_check
  CHECK (kind IN ('direct', 'room', 'marketplace', 'group', 'plan'));

-- Backfill the sort timestamp from existing history. No rows are removed.
UPDATE conversations c
   SET last_message_at = COALESCE(
         (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
         c.created_at
       )
 WHERE c.last_message_at IS NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS conversations_participant_one_idx
  ON conversations (participant_one, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_participant_two_idx
  ON conversations (participant_two, last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx
  ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_requests_recipient_idx
  ON message_requests (recipient_id, status);

-- A direct pair must be unique regardless of participant order. If an older
-- deployment already contains reversed duplicates we skip the index rather
-- than deleting anybody's history; start_conversation() also serialises
-- creation with an advisory lock.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS conversations_canonical_pair_idx
    ON conversations (
      least(participant_one, participant_two),
      greatest(participant_one, participant_two)
    )
    WHERE kind = 'direct';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped canonical pair index: reversed duplicate conversations already exist';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Per-user conversation settings (pin / mute / archive)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_settings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

-- ----------------------------------------------------------------------------
-- 3. Message reactions (one row per emoji per person per message)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT message_reactions_emoji_length CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON message_reactions (message_id);

-- ----------------------------------------------------------------------------
-- 4. Helpers — blocking, consent, rate limiting, last-message timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blocked_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM blocked_users
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_with(other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM blocked_users
     WHERE (blocker_id = auth.uid() AND blocked_id = other)
        OR (blocker_id = other AND blocked_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_has_suspended_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM conversations c
      JOIN profiles p ON p.id IN (c.participant_one, c.participant_two)
     WHERE c.id = p_conversation_id
       AND auth.uid() IN (c.participant_one, c.participant_two)
       AND COALESCE(p.is_suspended, FALSE) = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.may_message(sender UUID, recipient UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  pref            TEXT;
  sender_uni      UUID;
  recipient_uni   UUID;
BEGIN
  IF sender IS NULL OR recipient IS NULL OR sender = recipient THEN
    RETURN FALSE;
  END IF;

  IF public.is_blocked_between(sender, recipient) THEN
    RETURN FALSE;
  END IF;

  -- A suspended account can neither send nor receive direct messages.
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id IN (sender, recipient)
       AND COALESCE(p.is_suspended, FALSE) = TRUE
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.allow_direct_messages, 'requests_only')
    INTO pref
    FROM user_preferences up
   WHERE up.user_id = recipient;

  pref := COALESCE(pref, 'requests_only');

  IF pref = 'none' THEN
    RETURN FALSE;
  END IF;

  -- "Anyone" is the only choice that crosses the university boundary.
  IF pref = 'anyone' THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id INTO sender_uni
    FROM profiles p WHERE p.id = sender;
  SELECT p.primary_university_id INTO recipient_uni
    FROM profiles p WHERE p.id = recipient;

  IF sender_uni IS NULL OR recipient_uni IS NULL OR sender_uni <> recipient_uni THEN
    RETURN FALSE;
  END IF;

  -- 'verified_students' (UI: University Students Only) and 'requests_only'
  -- both allow a same-university student; the latter still needs consent.
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.message_request_required(sender UUID, recipient UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  pref TEXT;
BEGIN
  IF NOT public.may_message(sender, recipient) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.allow_direct_messages, 'requests_only')
    INTO pref
    FROM user_preferences up
   WHERE up.user_id = recipient;

  RETURN COALESCE(pref, 'requests_only') = 'requests_only';
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.conversation_id;
  ELSE
    target := NEW.conversation_id;
  END IF;

  UPDATE conversations
     SET last_message_at = COALESCE(
           (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = target),
           NOW()
         )
   WHERE id = target;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation ON messages;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_last_message();

-- A simple database-level ceiling. The app is the primary rate limiter; this
-- guard keeps a compromised client from flooding a conversation.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
      FROM messages
     WHERE sender_id = NEW.sender_id
       AND created_at > NOW() - INTERVAL '1 minute'
  ) >= 60 THEN
    RAISE EXCEPTION 'Too many messages — please slow down';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_rate_limit ON messages;
CREATE TRIGGER messages_rate_limit
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ----------------------------------------------------------------------------
-- 5. Consent-based start / accept / decline
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_conversation(UUID, TEXT, JSONB, TEXT);
CREATE FUNCTION public.start_conversation(
  p_other_id UUID,
  p_initial_note TEXT,
  p_context JSONB DEFAULT NULL,
  p_kind TEXT DEFAULT 'direct'
)
RETURNS TABLE (conversation_id UUID, status TEXT, request_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me           UUID := auth.uid();
  v_kind       TEXT := COALESCE(NULLIF(p_kind, ''), 'direct');
  v_note       TEXT := NULLIF(btrim(COALESCE(p_initial_note, '')), '');
  v_uni        UUID;
  other_uni    UUID;
  v_status     TEXT;
  v_requires   BOOLEAN;
  v_id         UUID;
  v_existing   conversations%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_other_id IS NULL OR p_other_id = me THEN
    RAISE EXCEPTION 'Choose another student';
  END IF;
  IF v_kind NOT IN ('direct', 'room', 'marketplace') THEN
    RAISE EXCEPTION 'Unsupported conversation type';
  END IF;
  IF v_note IS NULL THEN
    v_note := 'Hi!';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Opening message is too long';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_other_id) THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF NOT public.may_message(me, p_other_id) THEN
    RAISE EXCEPTION 'This student is not accepting messages from you';
  END IF;

  SELECT p.primary_university_id INTO v_uni FROM profiles p WHERE p.id = me;
  SELECT p.primary_university_id INTO other_uni FROM profiles p WHERE p.id = p_other_id;
  IF other_uni IS NULL THEN
    RAISE EXCEPTION 'That student has not set a university yet';
  END IF;
  v_uni := COALESCE(v_uni, other_uni);

  -- Serialise creation for this pair so a double tap cannot create two rows.
  PERFORM pg_advisory_xact_lock(
    hashtext(least(me, p_other_id)::text || ':' || greatest(me, p_other_id)::text)
  );

  -- One conversation per pair, regardless of which item it started from.
  -- The 001 UNIQUE(participant_one, participant_two) constraint enforces this,
  -- so look up the pair without filtering by kind.
  SELECT * INTO v_existing
    FROM conversations c
   WHERE (
       (c.participant_one = me AND c.participant_two = p_other_id)
       OR (c.participant_one = p_other_id AND c.participant_two = me)
     )
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      IF p_context IS NOT NULL THEN
        UPDATE conversations SET context = p_context, kind = v_kind
         WHERE id = v_existing.id;
      END IF;

      -- Sending the opening note into an existing chat is useful (marketplace
      -- "Message seller", profile "Message"), but a double tap must not create
      -- an identical duplicate.
      IF NOT EXISTS (
        SELECT 1 FROM messages m
         WHERE m.conversation_id = v_existing.id
           AND m.sender_id = me
           AND m.body = v_note
           AND m.created_at > NOW() - INTERVAL '5 minutes'
      ) THEN
        INSERT INTO messages (conversation_id, sender_id, body)
        VALUES (v_existing.id, me, v_note);
      END IF;

      RETURN QUERY SELECT v_existing.id, v_existing.status, 'none'::TEXT;
      RETURN;
    END IF;

    IF v_existing.status = 'archived' THEN
      UPDATE conversations
         SET status = 'active',
             last_message_at = NOW(),
             context = COALESCE(p_context, context),
             kind = CASE WHEN p_context IS NOT NULL THEN v_kind ELSE kind END
       WHERE id = v_existing.id;
      INSERT INTO messages (conversation_id, sender_id, body)
      VALUES (v_existing.id, me, v_note);
      RETURN QUERY SELECT v_existing.id, 'active'::TEXT, 'none'::TEXT;
      RETURN;
    END IF;

    IF v_existing.status = 'request_pending' THEN
      IF p_context IS NOT NULL THEN
        UPDATE conversations SET context = p_context, kind = v_kind
         WHERE id = v_existing.id;
      END IF;
      RETURN QUERY SELECT
        v_existing.id,
        v_existing.status,
        CASE WHEN v_existing.requested_by = me THEN 'sent' ELSE 'incoming' END;
      RETURN;
    END IF;

    -- Declined earlier: allow a fresh, explicit request. The old history and
    -- the old request row stay for the record.
    UPDATE conversations
       SET status = 'request_pending',
           requested_by = me,
           kind = v_kind,
           context = COALESCE(p_context, context),
           last_message_at = NOW()
     WHERE id = v_existing.id;

    INSERT INTO messages (conversation_id, sender_id, body)
    VALUES (v_existing.id, me, v_note);

    INSERT INTO message_requests
      (conversation_id, sender_id, recipient_id, context_type, initial_note, status)
    VALUES (v_existing.id, me, p_other_id, v_kind, v_note, 'pending');

    RETURN QUERY SELECT v_existing.id, 'request_pending'::TEXT, 'sent'::TEXT;
    RETURN;
  END IF;

  v_requires := public.message_request_required(me, p_other_id);
  v_status := CASE WHEN v_requires THEN 'request_pending' ELSE 'active' END;

  INSERT INTO conversations
    (university_id, participant_one, participant_two, status, kind, requested_by, last_message_at, context)
  VALUES
    (v_uni, least(me, p_other_id), greatest(me, p_other_id), v_status, v_kind, me, NOW(), p_context)
  RETURNING id INTO v_id;

  INSERT INTO messages (conversation_id, sender_id, body)
  VALUES (v_id, me, v_note);

  INSERT INTO message_requests
    (conversation_id, sender_id, recipient_id, context_type, initial_note, status)
  VALUES
    (v_id, me, p_other_id, v_kind, v_note, CASE WHEN v_requires THEN 'pending' ELSE 'accepted' END);

  RETURN QUERY SELECT
    v_id,
    v_status,
    CASE WHEN v_requires THEN 'sent' ELSE 'none' END;
END;
$$;

DROP FUNCTION IF EXISTS public.respond_to_message_request(UUID, BOOLEAN);
CREATE FUNCTION public.respond_to_message_request(
  p_conversation_id UUID,
  p_accept BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          UUID := auth.uid();
  v_status    TEXT;
  v_requested UUID;
  v_result    TEXT;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT c.status, c.requested_by
    INTO v_status, v_requested
    FROM conversations c
   WHERE c.id = p_conversation_id
     AND me IN (c.participant_one, c.participant_two)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  IF v_status <> 'request_pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;
  IF v_requested = me THEN
    RAISE EXCEPTION 'You cannot respond to your own request';
  END IF;

  v_result := CASE WHEN p_accept THEN 'active' ELSE 'declined' END;

  UPDATE conversations SET status = v_result WHERE id = p_conversation_id;

  UPDATE message_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END
   WHERE conversation_id = p_conversation_id
     AND recipient_id = me
     AND status = 'pending';

  IF p_accept THEN
    UPDATE messages
       SET is_read = TRUE
     WHERE conversation_id = p_conversation_id
       AND sender_id <> me
       AND COALESCE(is_read, FALSE) = FALSE;
  END IF;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Read receipts, reactions, blocking
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mark_conversation_read(UUID);
CREATE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations c
     WHERE c.id = p_conversation_id
       AND me IN (c.participant_one, c.participant_two)
  ) THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  UPDATE messages
     SET is_read = TRUE
   WHERE conversation_id = p_conversation_id
     AND sender_id <> me
     AND COALESCE(is_read, FALSE) = FALSE;
END;
$$;

DROP FUNCTION IF EXISTS public.toggle_message_reaction(UUID, TEXT);
CREATE FUNCTION public.toggle_message_reaction(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me       UUID := auth.uid();
  v_conv   UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_emoji IS NULL OR char_length(p_emoji) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT m.conversation_id INTO v_conv FROM messages m WHERE m.id = p_message_id;
  IF v_conv IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations c
     WHERE c.id = v_conv
       AND me IN (c.participant_one, c.participant_two)
  ) THEN
    RAISE EXCEPTION 'Not your conversation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM message_reactions r
     WHERE r.message_id = p_message_id AND r.user_id = me AND r.emoji = p_emoji
  ) THEN
    DELETE FROM message_reactions r
     WHERE r.message_id = p_message_id AND r.user_id = me AND r.emoji = p_emoji;
    RETURN FALSE;
  END IF;

  INSERT INTO message_reactions (message_id, user_id, emoji)
  VALUES (p_message_id, me, p_emoji);
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.block_user(UUID);
CREATE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = me THEN
    RAISE EXCEPTION 'Invalid account';
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_id)
  VALUES (me, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.unblock_user(UUID);
CREATE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  DELETE FROM blocked_users
   WHERE blocker_id = me AND blocked_id = p_blocked_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Inbox query — one round trip, no N+1, only the signed-in student's rows
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_inbox();
CREATE FUNCTION public.get_inbox()
RETURNS TABLE (
  conversation_id UUID,
  status TEXT,
  request_state TEXT,
  kind TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  other_id UUID,
  other_username TEXT,
  other_display_name TEXT,
  other_avatar_url TEXT,
  other_is_verified BOOLEAN,
  last_message_id UUID,
  last_message_sender UUID,
  last_message_body TEXT,
  last_message_photo TEXT,
  last_message_created_at TIMESTAMPTZ,
  unread_count BIGINT,
  pinned BOOLEAN,
  muted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH mine AS (
    SELECT
      c.*,
      CASE
        WHEN c.participant_one = auth.uid() THEN c.participant_two
        ELSE c.participant_one
      END AS other_id
    FROM conversations c
    WHERE auth.uid() IN (c.participant_one, c.participant_two)
  )
  SELECT
    m.id,
    m.status,
    CASE
      WHEN m.status = 'request_pending' AND m.requested_by = auth.uid() THEN 'sent'
      WHEN m.status = 'request_pending' THEN 'incoming'
      WHEN m.status = 'declined' THEN 'declined'
      ELSE 'none'
    END AS request_state,
    COALESCE(m.kind, 'direct'),
    m.context,
    m.created_at,
    COALESCE(m.last_message_at, m.created_at),
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified_student, FALSE),
    lm.id,
    lm.sender_id,
    lm.body,
    lm.photo_url,
    lm.created_at,
    COALESCE(u.cnt, 0),
    COALESCE(s.pinned, FALSE),
    COALESCE(s.muted, FALSE)
  FROM mine m
  JOIN profiles p ON p.id = m.other_id
  LEFT JOIN LATERAL (
    SELECT msg.id, msg.sender_id, msg.body, msg.photo_url, msg.created_at
      FROM messages msg
     WHERE msg.conversation_id = m.id
     ORDER BY msg.created_at DESC
     LIMIT 1
  ) lm ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS cnt
      FROM messages msg
     WHERE msg.conversation_id = m.id
       AND msg.sender_id <> auth.uid()
       AND COALESCE(msg.is_read, FALSE) = FALSE
  ) u ON TRUE
  LEFT JOIN conversation_settings s
    ON s.conversation_id = m.id
   AND s.user_id = auth.uid()
  WHERE COALESCE(s.archived, FALSE) = FALSE
    AND NOT public.is_blocked_between(m.participant_one, m.participant_two)
    AND NOT public.conversation_has_suspended_participant(m.id)
  ORDER BY COALESCE(m.last_message_at, m.created_at) DESC;
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS — replace the partial Phase 1 policies
-- ----------------------------------------------------------------------------
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Conversations keep the 002 SELECT policy (participants only). Creation and
-- status changes go through the RPCs above, so no INSERT/UPDATE policy exists.
DROP POLICY IF EXISTS "Participants can read messages" ON messages;
CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Send message only in active conversations and when not blocked" ON messages;
DROP POLICY IF EXISTS "Participants can send messages in active conversations" ON messages;
CREATE POLICY "Participants can send messages in active conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND c.status = 'active'
         AND auth.uid() IN (c.participant_one, c.participant_two)
         AND NOT public.is_blocked_with(
           CASE
             WHEN c.participant_one = auth.uid() THEN c.participant_two
             ELSE c.participant_one
           END
         )
         AND NOT public.conversation_has_suspended_participant(c.id)
    )
  );

-- Read receipts are written by mark_conversation_read(); no client UPDATE.

DROP POLICY IF EXISTS "Participants can read message requests" ON message_requests;
CREATE POLICY "Participants can read message requests"
  ON message_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can read their own blocks" ON blocked_users;
CREATE POLICY "Users can read their own blocks"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block others" ON blocked_users;
CREATE POLICY "Users can block others"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocked_id <> auth.uid());

DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users;
CREATE POLICY "Users can unblock others"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users manage their own conversation settings" ON conversation_settings;
CREATE POLICY "Users manage their own conversation settings"
  ON conversation_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can read message reactions" ON message_reactions;
CREATE POLICY "Participants can read message reactions"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = message_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can add their own reactions" ON message_reactions;
CREATE POLICY "Participants can add their own reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = message_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 9. Private message-photo storage
-- Path: <conversation_id>/<user_id>/<file>
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-photos',
  'message-photos',
  FALSE,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Conversation participants can read message photos" ON storage.objects;
CREATE POLICY "Conversation participants can read message photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-photos'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can upload message photos" ON storage.objects;
CREATE POLICY "Participants can upload message photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can delete their own message photos" ON storage.objects;
CREATE POLICY "Participants can delete their own message photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

-- ----------------------------------------------------------------------------
-- 10. Realtime — new messages and consent/status changes
-- RLS still decides which rows each subscriber can see. If the publication is
-- unavailable (self-hosted without Realtime) the migration continues.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Function grants — authenticated students only
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked_with(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conversation_has_suspended_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_message(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.message_request_required(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_conversation(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_message_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_message_reaction(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_inbox() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_blocked_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_has_suspended_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_message_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inbox() TO authenticated;

-- ============================================================
-- supabase/migrations/008_clubs_recognition.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Real clubs, membership cards & Campus Honours (Phase 4)
-- Migration: 008_clubs_recognition.sql
--
-- Additive only. 002 enabled RLS on organization_members but never added a
-- single policy, so the table was deny-all. This migration gives clubs a real,
-- audited lifecycle without letting a club grant itself university-level
-- verification:
--   • organization_members  — applications, approval, roles, alumni, cards
--   • organization_*        — representatives, committees, aliases,
--                             verification requests and an activity log
--   • campus_honours        — club-verified recognition, opt-out enforced at
--                             the data layer, no self-award
--   • SECURITY DEFINER RPCs — safe reads/writes for students, club managers
--                             and the public card-verification page
--
-- No existing rows are deleted. Verification status remains university-only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Additive membership / recognition fields
-- ----------------------------------------------------------------------------
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS membership_role TEXT NOT NULL DEFAULT 'Member';
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE campus_honours
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE campus_honours
  ADD COLUMN IF NOT EXISTS awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_org_status
  ON organization_members(organization_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_org_members_user_status
  ON organization_members(user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_campus_honours_org
  ON campus_honours(organization_id, created_at DESC);

-- Old memberships created before 004 may still miss a card token. Keep the
-- existing rows; only fill the missing token.
UPDATE organization_members
   SET membership_verify_token = encode(gen_random_bytes(24), 'hex')
 WHERE membership_verify_token IS NULL;

-- One pending university-review request per club at a time. If a deployment
-- already has duplicates we keep them and let the application layer explain
-- the pending state instead of deleting anybody's request.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_org_verification_pending
    ON organization_verification_requests(organization_id)
    WHERE status = 'pending';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped one-pending-verification index: duplicate pending requests already exist';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Club activity log (Control Center audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_activity_org_created
  ON organization_activity_log(organization_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Helpers — membership, management and tenant resolution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM organization_members
     WHERE organization_id = target_org
       AND user_id = auth.uid()
       AND membership_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.club_university(target_org UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT university_id FROM organizations WHERE id = target_org;
$$;

/** Club representative OR university admin. Used by RLS and RPCs. */
CREATE OR REPLACE FUNCTION public.is_club_manager(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_club_rep(target_org)
      OR EXISTS (
        SELECT 1
          FROM organizations o
         WHERE o.id = target_org
           AND public.user_has_role(
                 o.university_id,
                 ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
               )
      );
$$;

/** True when the caller belongs to the same university as the club. */
CREATE OR REPLACE FUNCTION public.shares_club_university(target_org UUID, target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM organizations o
     WHERE o.id = target_org
       AND (
         EXISTS (
           SELECT 1 FROM user_universities uu
            WHERE uu.user_id = target_user
              AND uu.university_id = o.university_id
         )
         OR EXISTS (
           SELECT 1 FROM profiles p
            WHERE p.id = target_user
              AND p.primary_university_id = o.university_id
         )
       )
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS — club tables
-- ----------------------------------------------------------------------------
ALTER TABLE organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

-- organization_members: own membership, or a manager. Approved members do not
-- get direct row access to classmates' motivation notes or card tokens; the
-- public club roster is served by get_club_detail() with only safe fields.
DROP POLICY IF EXISTS "Members can read their own membership or approved club roster" ON organization_members;
DROP POLICY IF EXISTS "Members can read their own membership; managers the roster" ON organization_members;
CREATE POLICY "Members can read their own membership; managers the roster"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_club_manager(organization_id)
  );

DROP POLICY IF EXISTS "Students can apply to open clubs" ON organization_members;
CREATE POLICY "Students can apply to open clubs"
  ON organization_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND membership_status = 'pending'
    AND membership_role = 'Member'
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM organizations o
       WHERE o.id = organization_id
         AND COALESCE(o.membership_open, TRUE)
    )
    AND public.shares_club_university(organization_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND COALESCE(p.is_suspended, FALSE)
    )
  );

DROP POLICY IF EXISTS "Students can withdraw their own pending application" ON organization_members;
CREATE POLICY "Students can withdraw their own pending application"
  ON organization_members FOR DELETE
  USING (user_id = auth.uid() AND membership_status = 'pending');

-- Direct membership edits are university-admin only. Club managers use the
-- audited RPCs below, so every approve/hold/reject is written to the log.
DROP POLICY IF EXISTS "University admins can correct club memberships" ON organization_members;
CREATE POLICY "University admins can correct club memberships"
  ON organization_members FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Representatives: public leadership roster; only the university assigns them.
DROP POLICY IF EXISTS "Representatives are public" ON organization_representatives;
CREATE POLICY "Representatives are public"
  ON organization_representatives FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can add representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can add representatives" ON organization_representatives;
CREATE POLICY "University admins can add representatives"
  ON organization_representatives FOR INSERT
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
    AND public.shares_club_university(organization_id, user_id)
  );

DROP POLICY IF EXISTS "Club managers can update representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can update representatives" ON organization_representatives;
CREATE POLICY "University admins can update representatives"
  ON organization_representatives FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
    AND public.shares_club_university(organization_id, user_id)
  );

DROP POLICY IF EXISTS "Club managers can remove representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can remove representatives" ON organization_representatives;
CREATE POLICY "University admins can remove representatives"
  ON organization_representatives FOR DELETE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Committees: public roster; managers maintain it.
DROP POLICY IF EXISTS "Committees are public" ON organization_committees;
CREATE POLICY "Committees are public"
  ON organization_committees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can maintain committees" ON organization_committees;
CREATE POLICY "Club managers can maintain committees"
  ON organization_committees FOR ALL
  USING (public.is_club_manager(organization_id))
  WITH CHECK (public.is_club_manager(organization_id));

-- Aliases: public reconciliation history; managers maintain it.
DROP POLICY IF EXISTS "Aliases are public" ON organization_aliases;
CREATE POLICY "Aliases are public"
  ON organization_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can maintain aliases" ON organization_aliases;
CREATE POLICY "Club managers can maintain aliases"
  ON organization_aliases FOR ALL
  USING (public.is_club_manager(organization_id))
  WITH CHECK (public.is_club_manager(organization_id));

-- Verification requests: submitters/managers can read; only university
-- admins can change the review status. Clubs can never self-approve.
DROP POLICY IF EXISTS "Managers can read their club verification requests" ON organization_verification_requests;
CREATE POLICY "Managers can read their club verification requests"
  ON organization_verification_requests FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR public.is_club_manager(organization_id)
    OR public.user_has_role(
         public.club_university(organization_id),
         ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
       )
  );

DROP POLICY IF EXISTS "Club managers can request verification" ON organization_verification_requests;
CREATE POLICY "Club managers can request verification"
  ON organization_verification_requests FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND public.is_club_manager(organization_id)
  );

DROP POLICY IF EXISTS "University admins review club verification" ON organization_verification_requests;
CREATE POLICY "University admins review club verification"
  ON organization_verification_requests FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Audit trail is readable by club managers. Writes happen through RPCs only.
DROP POLICY IF EXISTS "Club managers can read the activity log" ON organization_activity_log;
CREATE POLICY "Club managers can read the activity log"
  ON organization_activity_log FOR SELECT
  USING (public.is_club_manager(organization_id));

-- ----------------------------------------------------------------------------
-- 5. RLS — Campus Honours (replace 004's opt-out policy)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Honours are visible unless the student opted out" ON campus_honours;
CREATE POLICY "Honours are visible unless the student opted out"
  ON campus_honours FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_universities uu
       WHERE uu.user_id = auth.uid()
         AND uu.university_id = campus_honours.university_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_preferences up
       WHERE up.user_id = campus_honours.person_id
         AND up.show_in_honours = FALSE
    )
  );

DROP POLICY IF EXISTS "Club managers can award recognition to members" ON campus_honours;
CREATE POLICY "Club managers can award recognition to members"
  ON campus_honours FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND person_id <> auth.uid()
    AND awarded_by = auth.uid()
    AND points > 0
    AND (
      (
        verified_by = 'club'
        AND organization_id IS NOT NULL
        AND public.is_club_manager(organization_id)
        AND EXISTS (
          SELECT 1 FROM organization_members m
           WHERE m.organization_id = campus_honours.organization_id
             AND m.user_id = campus_honours.person_id
             AND m.membership_status = 'approved'
        )
      )
      OR (
        verified_by IN ('department', 'university')
        AND public.user_has_role(
              university_id,
              ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
            )
      )
    )
  );

DROP POLICY IF EXISTS "University admins can correct honours" ON campus_honours;
CREATE POLICY "University admins can correct honours"
  ON campus_honours FOR UPDATE
  USING (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

DROP POLICY IF EXISTS "University admins can remove honours" ON campus_honours;
CREATE POLICY "University admins can remove honours"
  ON campus_honours FOR DELETE
  USING (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

DROP POLICY IF EXISTS "Club managers can withdraw their own club recognition" ON campus_honours;
CREATE POLICY "Club managers can withdraw their own club recognition"
  ON campus_honours FOR DELETE
  USING (
    verified_by = 'club'
    AND organization_id IS NOT NULL
    AND public.is_club_manager(organization_id)
  );

-- ----------------------------------------------------------------------------
-- 6. Triggers — identity fields and university-only verification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_club_membership_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A membership cannot be moved to another club or student';
  END IF;
  IF NEW.membership_status NOT IN ('pending', 'approved', 'rejected', 'alumni') THEN
    RAISE EXCEPTION 'Invalid membership status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_membership_identity_trg ON organization_members;
CREATE TRIGGER protect_club_membership_identity_trg
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_membership_identity();

CREATE OR REPLACE FUNCTION public.protect_club_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / migration work has no auth.uid(); normal clients cannot
  -- update these rows without passing RLS first.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.user_has_role(
           OLD.university_id,
           ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
         ) THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Only the university can change a club verification level';
    END IF;
    IF NEW.university_id IS DISTINCT FROM OLD.university_id THEN
      RAISE EXCEPTION 'Only the university can move a club between tenants';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Only the university can change a club slug';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_identity_trg ON organizations;
CREATE TRIGGER protect_club_identity_trg
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_identity();

CREATE OR REPLACE FUNCTION public.protect_club_committee_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni UUID;
  v_was_verified BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'A committee record cannot be moved to another club';
    END IF;
    v_was_verified := COALESCE(OLD.is_verified_source, FALSE);
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT university_id INTO v_uni FROM organizations WHERE id = NEW.organization_id;

  IF NEW.is_verified_source = TRUE
     AND NOT v_was_verified
     AND NOT public.user_has_role(
               v_uni,
               ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
             ) THEN
    RAISE EXCEPTION 'Only the university can mark a committee record as a verified source';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_committee_source_trg ON organization_committees;
CREATE TRIGGER protect_club_committee_source_trg
  BEFORE INSERT OR UPDATE ON organization_committees
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_committee_source();

CREATE OR REPLACE FUNCTION public.protect_club_representative_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A representative record cannot be moved to another club or student';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_representative_identity_trg ON organization_representatives;
CREATE TRIGGER protect_club_representative_identity_trg
  BEFORE UPDATE ON organization_representatives
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_representative_identity();

-- ----------------------------------------------------------------------------
-- 7. Read RPCs
-- ----------------------------------------------------------------------------

/** Public club directory with approved member counts and caller manager flag. */
CREATE OR REPLACE FUNCTION public.get_clubs_directory()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'slug', o.slug,
        'name', o.name,
        'short_description', o.short_description,
        'about', o.about,
        'category', o.category,
        'scope_type', o.scope_type,
        'verification_status', o.verification_status,
        'membership_open', COALESCE(o.membership_open, TRUE),
        'membership_requirements', o.membership_requirements,
        'logo_url', o.logo_url,
        'cover_url', o.cover_url,
        'source_url', o.source_url,
        'official_website', o.official_website,
        'member_count', (
          SELECT count(*)::int
            FROM organization_members m
           WHERE m.organization_id = o.id
             AND m.membership_status = 'approved'
        ),
        'is_manager', public.is_club_manager(o.id)
      )
      ORDER BY o.name
    )
    FROM organizations o
    WHERE auth.uid() IS NOT NULL
      AND (
        o.university_id IN (
          SELECT uu.university_id
            FROM user_universities uu
           WHERE uu.user_id = auth.uid()
        )
        OR o.university_id = (
          SELECT p.primary_university_id
            FROM profiles p
           WHERE p.id = auth.uid()
        )
      )
  ), '[]'::jsonb);
END;
$$;

/** Public club identity, leadership, committee, aliases and caller state. */
CREATE OR REPLACE FUNCTION public.get_club_detail(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_org
    FROM organizations
   WHERE slug = p_slug
     AND v_uid IS NOT NULL
     AND (
       university_id IN (
         SELECT uu.university_id
           FROM user_universities uu
          WHERE uu.user_id = v_uid
       )
       OR university_id = (
         SELECT p.primary_university_id
           FROM profiles p
          WHERE p.id = v_uid
       )
     )
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'club', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'short_description', v_org.short_description,
      'about', v_org.about,
      'category', v_org.category,
      'scope_type', v_org.scope_type,
      'verification_status', v_org.verification_status,
      'membership_open', COALESCE(v_org.membership_open, TRUE),
      'membership_requirements', v_org.membership_requirements,
      'logo_url', v_org.logo_url,
      'cover_url', v_org.cover_url,
      'source_url', v_org.source_url,
      'official_website', v_org.official_website
    ),
    'member_count', (
      SELECT count(*)::int
        FROM organization_members m
       WHERE m.organization_id = v_org.id
         AND m.membership_status = 'approved'
    ),
    'representatives', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', r.user_id,
          'name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'designation', r.designation
        )
        ORDER BY r.designation
      )
      FROM organization_representatives r
      JOIN profiles p ON p.id = r.user_id
      WHERE r.organization_id = v_org.id
    ), '[]'::jsonb),
    'committee', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_title', c.role_title,
          'member_name', c.member_name,
          'session_term', c.session_term,
          'is_verified_source', c.is_verified_source,
          'source_url', c.source_url
        )
        ORDER BY c.role_title
      )
      FROM organization_committees c
      WHERE c.organization_id = v_org.id
    ), '[]'::jsonb),
    'aliases', COALESCE((
      SELECT jsonb_agg(a.alias_name ORDER BY a.alias_name)
      FROM organization_aliases a
      WHERE a.organization_id = v_org.id
    ), '[]'::jsonb),
    'my_membership', (
      SELECT jsonb_build_object(
        'status', m.membership_status,
        'role', m.membership_role
      )
      FROM organization_members m
      WHERE m.organization_id = v_org.id
        AND m.user_id = v_uid
      LIMIT 1
    ),
    'is_manager', public.is_club_manager(v_org.id),
    'honours', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', h.id,
          'person_id', h.person_id,
          'person_name', p.display_name,
          'department_code', COALESCE(d.code, 'NUB'),
          'category', h.category,
          'title', h.title,
          'detail', h.detail,
          'points', h.points,
          'semester', h.semester,
          'created_at', h.created_at
        ) AS x
        FROM campus_honours h
        JOIN profiles p ON p.id = h.person_id
        LEFT JOIN departments d ON d.id = p.department_id
        WHERE h.organization_id = v_org.id
          AND NOT EXISTS (
            SELECT 1 FROM user_preferences up
             WHERE up.user_id = h.person_id
               AND up.show_in_honours = FALSE
          )
        ORDER BY h.created_at DESC
        LIMIT 10
      ) recent
    ), '[]'::jsonb)
  );
END;
$$;

/** The signed-in student's memberships + clubs they can manage. */
CREATE OR REPLACE FUNCTION public.get_my_club_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('memberships', '[]'::jsonb, 'managed', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'memberships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization_id', m.organization_id,
          'slug', o.slug,
          'name', o.name,
          'status', m.membership_status,
          'role', m.membership_role,
          'joined_at', m.joined_at,
          'verify_token', m.membership_verify_token,
          'category', o.category,
          'verification_status', o.verification_status
        )
        ORDER BY o.name
      )
      FROM organization_members m
      JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = v_uid
    ), '[]'::jsonb),
    'managed', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization_id', r.organization_id,
          'slug', o.slug,
          'name', o.name,
          'designation', r.designation
        )
        ORDER BY o.name
      )
      FROM organization_representatives r
      JOIN organizations o ON o.id = r.organization_id
      WHERE r.user_id = v_uid
    ), '[]'::jsonb)
  );
END;
$$;

/** Recognition feed — university-scoped and opt-out aware. */
CREATE OR REPLACE FUNCTION public.get_honours_feed(p_semester TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'person_id', h.person_id,
        'person_name', p.display_name,
        'department_code', COALESCE(d.code, 'NUB'),
        'category', h.category,
        'title', h.title,
        'detail', h.detail,
        'points', h.points,
        'semester', h.semester,
        'verified_by', h.verified_by,
        'organization_name', o.name,
        'created_at', h.created_at
      )
      ORDER BY h.created_at DESC
    )
    FROM campus_honours h
    JOIN profiles p ON p.id = h.person_id
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN organizations o ON o.id = h.organization_id
    WHERE (p_semester IS NULL OR h.semester = p_semester)
      AND (
        h.university_id IN (
          SELECT uu.university_id
            FROM user_universities uu
           WHERE uu.user_id = auth.uid()
        )
        OR h.university_id = (
          SELECT p.primary_university_id
            FROM profiles p
           WHERE p.id = auth.uid()
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_preferences up
         WHERE up.user_id = h.person_id
           AND up.show_in_honours = FALSE
      )
  ), '[]'::jsonb);
END;
$$;

/** Public read-only membership card lookup. Safe fields only. */
CREATE OR REPLACE FUNCTION public.get_membership_card(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'club_slug', o.slug,
      'club_name', o.name,
      'person_name', p.display_name,
      'person_department',
        COALESCE(d.code, 'NUB') ||
        CASE WHEN p.semester_label IS NOT NULL AND length(btrim(p.semester_label)) > 0
             THEN ' • ' || p.semester_label ELSE '' END,
      'role', COALESCE(NULLIF(btrim(m.membership_role), ''), 'Member'),
      'since', to_char(COALESCE(m.joined_at, m.reviewed_at, NOW()), 'Mon YYYY'),
      'status', m.membership_status
    )
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    JOIN profiles p ON p.id = m.user_id
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE m.membership_verify_token = p_token
      AND m.membership_status = 'approved'
    LIMIT 1
  );
END;
$$;

/** Full Control Center payload. Managers only. */
CREATE OR REPLACE FUNCTION public.get_club_manage_data(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can open the Control Center';
  END IF;

  RETURN jsonb_build_object(
    'club', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'short_description', v_org.short_description,
      'about', v_org.about,
      'category', v_org.category,
      'scope_type', v_org.scope_type,
      'verification_status', v_org.verification_status,
      'membership_open', COALESCE(v_org.membership_open, TRUE),
      'membership_requirements', v_org.membership_requirements,
      'logo_url', v_org.logo_url,
      'cover_url', v_org.cover_url,
      'source_url', v_org.source_url
    ),
    'member_count', (
      SELECT count(*)::int
        FROM organization_members m
       WHERE m.organization_id = p_org_id
         AND m.membership_status = 'approved'
    ),
    'applications', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'user_id', m.user_id,
          'name', p.display_name,
          'username', p.username,
          'department_code', COALESCE(d.code, 'NUB'),
          'semester', p.semester_label,
          'motivation', m.motivation_note,
          'applied_at', m.joined_at
        )
        ORDER BY m.joined_at
      )
      FROM organization_members m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE m.organization_id = p_org_id
        AND m.membership_status = 'pending'
    ), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'user_id', m.user_id,
          'name', p.display_name,
          'username', p.username,
          'department_code', COALESCE(d.code, 'NUB'),
          'semester', p.semester_label,
          'role', m.membership_role,
          'status', m.membership_status,
          'joined_at', m.joined_at
        )
        ORDER BY p.display_name
      )
      FROM organization_members m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE m.organization_id = p_org_id
        AND m.membership_status = 'approved'
    ), '[]'::jsonb),
    'representatives', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', r.user_id,
          'name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'designation', r.designation
        )
        ORDER BY r.designation
      )
      FROM organization_representatives r
      JOIN profiles p ON p.id = r.user_id
      WHERE r.organization_id = p_org_id
    ), '[]'::jsonb),
    'committee', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_title', c.role_title,
          'member_name', c.member_name,
          'session_term', c.session_term,
          'is_verified_source', c.is_verified_source,
          'source_url', c.source_url
        )
        ORDER BY c.role_title
      )
      FROM organization_committees c
      WHERE c.organization_id = p_org_id
    ), '[]'::jsonb),
    'honours', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'person_id', h.person_id,
          'person_name', p.display_name,
          'department_code', COALESCE(d.code, 'NUB'),
          'category', h.category,
          'title', h.title,
          'detail', h.detail,
          'points', h.points,
          'semester', h.semester,
          'created_at', h.created_at
        )
        ORDER BY h.created_at DESC
      )
      FROM campus_honours h
      JOIN profiles p ON p.id = h.person_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE h.organization_id = p_org_id
        AND NOT EXISTS (
          SELECT 1 FROM user_preferences up
           WHERE up.user_id = h.person_id
             AND up.show_in_honours = FALSE
        )
    ), '[]'::jsonb),
    'verification_requests', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'status', v.status,
          'notes', v.notes,
          'advisor_name', v.advisor_name,
          'evidence_urls', v.evidence_urls,
          'created_at', v.created_at,
          'reviewed_at', v.reviewed_at
        )
        ORDER BY v.created_at DESC
      )
      FROM organization_verification_requests v
      WHERE v.organization_id = p_org_id
    ), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action', a.action,
          'detail', a.detail,
          'actor_name', p.display_name,
          'created_at', a.created_at
        )
        ORDER BY a.created_at DESC
      )
      FROM (
        SELECT * FROM organization_activity_log
         WHERE organization_id = p_org_id
         ORDER BY created_at DESC
         LIMIT 50
      ) a
      LEFT JOIN profiles p ON p.id = a.actor_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Write RPCs — students
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_to_organization(p_org_id UUID, p_note TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org organizations%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply to a club';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT COALESCE(v_org.membership_open, TRUE) THEN
    RAISE EXCEPTION 'This club is not accepting applications right now';
  END IF;
  IF NOT public.shares_club_university(p_org_id, v_uid) THEN
    RAISE EXCEPTION 'This club is for students of its own university';
  END IF;
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = v_uid AND COALESCE(p.is_suspended, FALSE)
  ) THEN
    RAISE EXCEPTION 'Your account is suspended';
  END IF;
  IF p_note IS NOT NULL AND length(btrim(p_note)) > 1000 THEN
    RAISE EXCEPTION 'Keep your application note to 1000 characters or fewer';
  END IF;
  IF (
    SELECT count(*)
      FROM organization_activity_log
     WHERE organization_id = p_org_id
       AND actor_id = v_uid
       AND action = 'application_submitted'
       AND created_at > NOW() - INTERVAL '1 day'
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many applications in a short time. Please try again tomorrow.';
  END IF;

  SELECT membership_status INTO v_status
    FROM organization_members
   WHERE organization_id = p_org_id AND user_id = v_uid;

  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'You are already a member of this club';
  END IF;
  IF v_status = 'pending' THEN
    RAISE EXCEPTION 'Your application is already pending';
  END IF;

  INSERT INTO organization_members (
    organization_id, user_id, membership_status, motivation_note,
    reviewed_by, reviewed_at, review_note
  )
  VALUES (
    p_org_id, v_uid, 'pending', NULLIF(btrim(p_note), ''),
    NULL, NULL, NULL
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET membership_status = 'pending',
        membership_role = 'Member',
        motivation_note = EXCLUDED.motivation_note,
        reviewed_by = NULL,
        reviewed_at = NULL,
        review_note = NULL,
        joined_at = NOW();

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'application_submitted', 'Membership application submitted');

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_club_application(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deleted UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to withdraw an application';
  END IF;

  DELETE FROM organization_members
   WHERE organization_id = p_org_id
     AND user_id = v_uid
     AND membership_status = 'pending'
  RETURNING organization_id INTO v_deleted;

  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'No pending application to withdraw';
  END IF;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'application_withdrawn', 'Membership application withdrawn');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_organization(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to leave a club';
  END IF;

  SELECT membership_status INTO v_status
    FROM organization_members
   WHERE organization_id = p_org_id AND user_id = v_uid
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this club';
  END IF;

  IF v_status = 'pending' THEN
    DELETE FROM organization_members
     WHERE organization_id = p_org_id AND user_id = v_uid;
    INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
    VALUES (p_org_id, v_uid, 'application_withdrawn', 'Membership application withdrawn');
    RETURN 'withdrawn';
  END IF;

  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'You are not an active member of this club';
  END IF;

  UPDATE organization_members
     SET membership_status = 'alumni'
   WHERE organization_id = p_org_id AND user_id = v_uid;

  -- A student who leaves must not keep representative powers over the club.
  DELETE FROM organization_representatives
   WHERE organization_id = p_org_id
     AND user_id = v_uid;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'membership_left', 'Member left the club');

  RETURN 'alumni';
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Write RPCs — club managers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_club_application(
  p_membership_id UUID,
  p_decision TEXT,
  p_role TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID;
  v_status TEXT;
  v_person UUID;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to review applications';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;
  IF p_role IS NOT NULL AND length(btrim(p_role)) > 60 THEN
    RAISE EXCEPTION 'Keep the role to 60 characters or fewer';
  END IF;

  SELECT organization_id, membership_status, user_id
    INTO v_org, v_status, v_person
    FROM organization_members
   WHERE id = p_membership_id
   FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF NOT public.is_club_manager(v_org) THEN
    RAISE EXCEPTION 'Only club representatives can review applications';
  END IF;
  IF v_person = v_uid THEN
    RAISE EXCEPTION 'You cannot review your own application';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'This application is no longer pending';
  END IF;

  UPDATE organization_members
     SET membership_status = p_decision,
         reviewed_by = v_uid,
         reviewed_at = NOW(),
         review_note = NULLIF(btrim(p_note), ''),
         membership_role = CASE
           WHEN p_decision = 'approved'
             THEN COALESCE(NULLIF(btrim(p_role), ''), membership_role, 'Member')
           ELSE membership_role
         END
   WHERE id = p_membership_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = v_person;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (
    v_org,
    v_uid,
    CASE p_decision
      WHEN 'approved' THEN 'membership_approved'
      WHEN 'rejected' THEN 'membership_rejected'
      ELSE 'application_held'
    END,
    COALESCE(v_name, 'A student')
  );

  RETURN p_decision;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_club_member_role(
  p_membership_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID;
  v_status TEXT;
  v_person UUID;
  v_name TEXT;
  v_role TEXT := btrim(p_role);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to update a member role';
  END IF;
  IF v_role IS NULL OR length(v_role) = 0 OR length(v_role) > 60 THEN
    RAISE EXCEPTION 'Enter a role name of 60 characters or fewer';
  END IF;

  SELECT organization_id, membership_status, user_id
    INTO v_org, v_status, v_person
    FROM organization_members
   WHERE id = p_membership_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  IF NOT public.is_club_manager(v_org) THEN
    RAISE EXCEPTION 'Only club representatives can update member roles';
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved members can hold a club role';
  END IF;

  UPDATE organization_members
     SET membership_role = v_role
   WHERE id = p_membership_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = v_person;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (v_org, v_uid, 'member_role_updated', COALESCE(v_name, 'A member') || ' → ' || v_role);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_club_honour(
  p_org_id UUID,
  p_person_id UUID,
  p_category TEXT,
  p_title TEXT,
  p_detail TEXT DEFAULT NULL,
  p_points INTEGER DEFAULT 10,
  p_semester TEXT DEFAULT 'Fall 2026'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org organizations%ROWTYPE;
  v_name TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to award recognition';
  END IF;
  IF p_category NOT IN (
    'Mentoring', 'Organizing', 'Community Help',
    'Knowledge Sharing', 'Creative Contribution', 'Volunteering'
  ) THEN
    RAISE EXCEPTION 'Invalid recognition category';
  END IF;
  IF p_points IS NULL OR p_points < 1 OR p_points > 100 THEN
    RAISE EXCEPTION 'Points must be between 1 and 100';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) < 3 THEN
    RAISE EXCEPTION 'Enter a recognition title';
  END IF;
  IF length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'Keep the title to 120 characters or fewer';
  END IF;
  IF p_detail IS NOT NULL AND length(btrim(p_detail)) > 500 THEN
    RAISE EXCEPTION 'Keep the detail to 500 characters or fewer';
  END IF;
  IF p_semester IS NULL OR length(btrim(p_semester)) = 0 THEN
    RAISE EXCEPTION 'Choose a semester';
  END IF;
  IF length(btrim(p_semester)) > 40 THEN
    RAISE EXCEPTION 'Keep the semester label to 40 characters or fewer';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can award recognition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members m
     WHERE m.organization_id = p_org_id
       AND m.user_id = p_person_id
       AND m.membership_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Recognition can only be awarded to approved club members';
  END IF;
  IF p_person_id = v_uid THEN
    RAISE EXCEPTION 'You cannot award recognition to yourself';
  END IF;

  INSERT INTO campus_honours (
    university_id, person_id, category, title, detail,
    points, semester, verified_by, organization_id, awarded_by
  )
  VALUES (
    v_org.university_id, p_person_id, p_category, btrim(p_title),
    NULLIF(btrim(p_detail), ''), p_points, btrim(p_semester),
    'club', p_org_id, v_uid
  )
  RETURNING id INTO v_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_person_id;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (
    p_org_id, v_uid, 'recognition_awarded',
    COALESCE(v_name, 'A member') || ' · ' || p_category || ' · +' || p_points
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_club_verification(
  p_org_id UUID,
  p_evidence_urls TEXT[] DEFAULT '{}',
  p_notes TEXT DEFAULT NULL,
  p_advisor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a verification review';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can request a verification review';
  END IF;
  IF p_notes IS NOT NULL AND length(btrim(p_notes)) > 1000 THEN
    RAISE EXCEPTION 'Keep the review notes to 1000 characters or fewer';
  END IF;
  IF p_advisor IS NOT NULL AND length(btrim(p_advisor)) > 120 THEN
    RAISE EXCEPTION 'Keep the advisor name to 120 characters or fewer';
  END IF;
  IF p_evidence_urls IS NOT NULL THEN
    IF array_length(p_evidence_urls, 1) > 5 THEN
      RAISE EXCEPTION 'Add at most five evidence links';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_evidence_urls) u
       WHERE u IS NULL OR u !~* '^https?://'
    ) THEN
      RAISE EXCEPTION 'Evidence links must start with http:// or https://';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM organization_verification_requests
     WHERE organization_id = p_org_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A verification review is already pending';
  END IF;

  INSERT INTO organization_verification_requests (
    organization_id, submitted_by, evidence_urls, advisor_name, notes, status
  )
  VALUES (
    p_org_id, v_uid, COALESCE(p_evidence_urls, '{}'), NULLIF(btrim(p_advisor), ''),
    NULLIF(btrim(p_notes), ''), 'pending'
  )
  RETURNING id INTO v_id;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'verification_requested', 'University re-verification review requested');

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Grants — public reads only where safe, writes to authenticated students
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_clubs_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_club_detail(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_membership_card(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_club_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_honours_feed(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_club_manage_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_to_organization(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_club_application(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_club_application(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_club_member_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_club_honour(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_club_verification(UUID, TEXT[], TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clubs_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_detail(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_membership_card(TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_club_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_honours_feed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_manage_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_club_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_club_application(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_member_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_club_honour(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_club_verification(UUID, TEXT[], TEXT, TEXT) TO authenticated;

-- ============================================================
-- supabase/migrations/009_auth_user_defaults.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Auth row hardening (Phase 5 groundwork)
-- Migration: 009_auth_user_defaults.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Supabase Auth (GoTrue) reads `auth.users` into a Go struct where most token
-- columns are plain strings. A row that stores NULL in those columns cannot
-- be scanned, so `findUser` fails and every sign-in attempt for that account
-- returns HTTP 500 "Database error querying schema" — a silent, total
-- sign-out failure with no useful server-side message.
--
-- GoTrue always writes those columns explicitly, so a normal sign-up is fine.
-- The failure appears whenever an account is created outside the sign-up path
-- (QA tooling, an admin script, a restored backup): the INSERT omits the
-- token columns, so they stay NULL instead of ''.
--
-- This migration makes the table match the shape GoTrue expects:
--   1. Existing NULL rows are normalised to the values GoTrue writes.
--   2. The columns get those values as DEFAULTS, so future inserts are safe
--      too. Step 2 needs ownership of auth.users, which only the project's
--      SQL owner has; step 1 only needs UPDATE and always runs.
--
-- Additive and non-destructive: no row is deleted, no real value is
-- overwritten (only NULL becomes the value GoTrue would have written), and no
-- RLS policy, trigger or function is touched. Re-running it is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Normalise rows that predate the expected shape.
--    UPDATE on auth.users is granted to the project database role, so this
--    part runs for anyone applying the bundle.
-- ----------------------------------------------------------------------------
UPDATE auth.users
   SET aud                          = COALESCE(aud, 'authenticated'),
       role                         = COALESCE(role, 'authenticated'),
       confirmation_token           = COALESCE(confirmation_token, ''),
       recovery_token               = COALESCE(recovery_token, ''),
       email_change_token_current   = COALESCE(email_change_token_current, ''),
       email_change_token_new       = COALESCE(email_change_token_new, ''),
       email_change                 = COALESCE(email_change, ''),
       phone_change_token           = COALESCE(phone_change_token, ''),
       phone_change                 = COALESCE(phone_change, ''),
       reauthentication_token       = COALESCE(reauthentication_token, ''),
       email_change_confirm_status  = COALESCE(email_change_confirm_status, 0),
       is_super_admin               = COALESCE(is_super_admin, false),
       raw_app_meta_data            = COALESCE(raw_app_meta_data, '{}'::jsonb),
       raw_user_meta_data           = COALESCE(raw_user_meta_data, '{}'::jsonb)
 WHERE aud IS NULL
    OR role IS NULL
    OR confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change_token_current IS NULL
    OR email_change_token_new IS NULL
    OR email_change IS NULL
    OR phone_change_token IS NULL
    OR phone_change IS NULL
    OR reauthentication_token IS NULL
    OR email_change_confirm_status IS NULL
    OR is_super_admin IS NULL
    OR raw_app_meta_data IS NULL
    OR raw_user_meta_data IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Give the same columns those values as DEFAULTS, so an account inserted
--    by tooling is never left with NULLs again.
--
--    auth.users is owned by Supabase Auth, so ALTER TABLE needs the project
--    owner. When this migration is applied by a role that does not own the
--    table the step is skipped with a notice instead of failing the whole
--    bundle; run it once from the Supabase SQL editor to enable it.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
           SELECT 1
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'auth'
              AND c.relname = 'users'
              AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
         ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE NOTICE
      '009: skipping auth.users defaults — current role % does not own auth.users. Run this file from the Supabase SQL editor as the project owner to enable them.',
      current_user;
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN aud SET DEFAULT ''authenticated''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN role SET DEFAULT ''authenticated''';

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN recovery_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_token_current SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_token_new SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN phone_change_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN phone_change SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN reauthentication_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_confirm_status SET DEFAULT 0';

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN is_super_admin SET DEFAULT false';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN raw_app_meta_data SET DEFAULT ''{}''::jsonb';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN raw_user_meta_data SET DEFAULT ''{}''::jsonb';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN created_at SET DEFAULT now()';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN updated_at SET DEFAULT now()';

  RAISE NOTICE '009: auth.users defaults applied.';
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Identities always carry the owner's email.
--    `auth.identities.email` is generated from identity_data, so an identity
--    row without an email produces NULL there. This mirrors the backfill
--    Supabase Auth runs for invited users.
-- ----------------------------------------------------------------------------
UPDATE auth.identities AS i
   SET identity_data = i.identity_data || jsonb_build_object('email', u.email)
  FROM auth.users AS u
 WHERE u.id = i.user_id
   AND u.email IS NOT NULL
   AND i.identity_data ->> 'email' IS NULL;

-- ============================================================
-- supabase/migrations/010_real_feed.sql
-- ============================================================

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

-- ============================================================
-- supabase/migrations/011_pages_and_provenance.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Pages, page-authored content and launch provenance
-- Migration: 011_pages_and_provenance.sql
--
-- WHY THIS EXISTS
-- ---------------
-- The platform needs an identity that is not a student account: the official
-- "NUB Connect" Page, and later club and department Pages. A Page publishes
-- on its own behalf, so an announcement never appears to come from a random
-- student's profile.
--
-- Launch content also has to be attributable and removable later without
-- touching genuine student contributions. Every launch post therefore records
-- where it came from, who reviewed it, what rights the image carries, which
-- seed batch it belongs to and whether it may be archived.
--
-- Additive only: no row is deleted or rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id       UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  -- platform  → the official NUB Connect Page
  -- club      → an approved club's Page (linked through organization_id)
  -- department→ a department's Page
  -- community → a student-led community Page
  kind                TEXT NOT NULL DEFAULT 'community',
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  description         TEXT,
  avatar_url          TEXT,
  cover_url           TEXT,
  verification_status verification_status_enum NOT NULL DEFAULT 'awaiting_verification',
  owner_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pages_university_slug_key UNIQUE (university_id, slug),
  CONSTRAINT pages_kind_check CHECK (kind IN ('platform', 'club', 'department', 'community'))
);

CREATE TABLE IF NOT EXISTS public.page_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id    UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_role  TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_members_page_user_key UNIQUE (page_id, user_id),
  CONSTRAINT page_members_role_check CHECK (page_role IN ('owner', 'admin', 'editor', 'moderator'))
);

CREATE INDEX IF NOT EXISTS pages_organization_idx ON public.pages(organization_id);
CREATE INDEX IF NOT EXISTS page_members_user_idx ON public.page_members(user_id);

-- ----------------------------------------------------------------------------
-- 2. Who may manage a Page
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_page(target_page UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  page_row  public.pages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO page_row FROM public.pages WHERE id = target_page;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF page_row.owner_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.page_members pm
     WHERE pm.page_id = target_page
       AND pm.user_id = auth.uid()
       AND pm.page_role IN ('owner', 'admin', 'editor')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Platform administrators govern every Page.
  RETURN EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('university_admin', 'platform_super_admin')
  );
END
$$;

REVOKE ALL ON FUNCTION public.can_manage_page(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_page(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Launch provenance on posts
--    Every launch post keeps its source, its rights and its review trail, so
--    the owner can find and retire it later without touching student posts.
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_seed_content BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS seed_batch TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_organization TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS original_published_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_source TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_rights TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS internal_reviewer TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS removal_eligible BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_publication_status_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_publication_status_check
      CHECK (publication_status IN ('draft', 'scheduled', 'published', 'archived'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS posts_page_idx ON public.posts(page_id);
CREATE INDEX IF NOT EXISTS posts_seed_batch_idx ON public.posts(seed_batch) WHERE is_seed_content;

-- ----------------------------------------------------------------------------
-- 4. Page RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active pages are publicly readable" ON public.pages;
CREATE POLICY "Active pages are publicly readable"
  ON public.pages
  FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS "Page managers can create pages" ON public.pages;
CREATE POLICY "Page managers can create pages"
  ON public.pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  );

DROP POLICY IF EXISTS "Page managers can update their pages" ON public.pages;
CREATE POLICY "Page managers can update their pages"
  ON public.pages
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_page(id))
  WITH CHECK (public.can_manage_page(id));

DROP POLICY IF EXISTS "Page managers can retire their pages" ON public.pages;
CREATE POLICY "Page managers can retire their pages"
  ON public.pages
  FOR DELETE
  TO authenticated
  USING (public.can_manage_page(id));

DROP POLICY IF EXISTS "Page membership is readable" ON public.page_members;
CREATE POLICY "Page membership is readable"
  ON public.page_members
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Page managers can manage membership" ON public.page_members;
CREATE POLICY "Page managers can manage membership"
  ON public.page_members
  FOR ALL
  TO authenticated
  USING (public.can_manage_page(page_id))
  WITH CHECK (public.can_manage_page(page_id));

-- ----------------------------------------------------------------------------
-- 5. Posts: a Page may publish on its own behalf
--    A student post is still pinned to `student_created` and to its author.
--    A Page post must name a Page the author actually manages.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can publish their own posts" ON public.posts;
CREATE POLICY "Students can publish their own posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND university_id IN (
      SELECT uu.university_id
        FROM public.user_universities uu
       WHERE uu.user_id = auth.uid()
    )
    AND (
      -- A student post: no Page, student origin only.
      (
        page_id IS NULL
        AND content_origin = 'student_created'
      )
      OR
      -- A Page post: the author must manage the Page, and the origin must
      -- match what that Page is allowed to publish.
      (
        page_id IS NOT NULL
        AND public.can_manage_page(page_id)
        AND content_origin IN ('official_university', 'department_published', 'verified_club', 'recognized_organization')
      )
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
  USING (
    author_id = auth.uid()
    OR (page_id IS NOT NULL AND public.can_manage_page(page_id))
  )
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (page_id IS NULL AND content_origin = 'student_created')
      OR
      (page_id IS NOT NULL
       AND public.can_manage_page(page_id)
       AND content_origin IN ('official_university', 'department_published', 'verified_club', 'recognized_organization'))
    )
  );

-- ----------------------------------------------------------------------------
-- 6. The Page follower list
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_follows (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id    UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_follows_page_user_key UNIQUE (page_id, user_id)
);

ALTER TABLE public.page_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page follows are readable" ON public.page_follows;
CREATE POLICY "Page follows are readable"
  ON public.page_follows
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Students manage their own page follows" ON public.page_follows;
CREATE POLICY "Students manage their own page follows"
  ON public.page_follows
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. The official platform Page
--    The platform itself needs an identity that survives every student's
--    account. It is created here so the launch content always has a real
--    publisher, even on a brand-new database.
-- ----------------------------------------------------------------------------
INSERT INTO public.pages (university_id, slug, name, kind, description, verification_status, is_active)
SELECT u.id,
       'nub-connect',
       'NUB Connect',
       'platform',
       'The official NUB Connect page — campus announcements, verified university information and platform news.',
       'officially_verified',
       TRUE
  FROM public.universities u
 WHERE u.slug = 'nub'
ON CONFLICT (university_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      verification_status = EXCLUDED.verification_status,
      is_active = EXCLUDED.is_active,
      updated_at = now();

-- The platform Page posts as itself: a dedicated, non-personal identity.
-- It is an account that cannot be signed into — its password is random and
-- never published — so no student can impersonate the platform.
DO $$
DECLARE
  v_uni   UUID;
  v_page  UUID;
  v_user  UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;
  SELECT id INTO v_page FROM public.pages WHERE university_id = v_uni AND slug = 'nub-connect' LIMIT 1;

  IF v_page IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE email = 'nub-connect-official@platform.invalid' LIMIT 1;

  IF v_user IS NULL THEN
    v_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_current, email_change_token_new,
      email_change, phone_change_token, phone_change, reauthentication_token,
      email_change_confirm_status, is_super_admin, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'nub-connect-official@platform.invalid',
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
      '', '', '', '', '', '', '', '', 0, false,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"NUB Connect","username":"nub-connect-official"}'::jsonb,
      now(), now()
    );
  END IF;

  -- The new-user trigger creates the matching profile and preferences row.
  UPDATE public.pages
     SET owner_id = (SELECT id FROM public.profiles WHERE username = 'nub-connect-official' LIMIT 1),
         updated_at = now()
   WHERE id = v_page;
END
$$;

-- ============================================================
-- supabase/migrations/012_campus_pulse.sql
-- ============================================================

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

-- ============================================================
-- supabase/migrations/013_admin_command_centre.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT — Admin command centre
-- Migration: 013_admin_command_centre.sql
--
-- WHY THIS EXISTS
-- ---------------
-- PART 13/28 of the master prompt asks for one administrative command centre
-- backed by the same database as the student app. The schema already has
-- `user_roles`, `reports`, `moderation_actions`, `system_settings`,
-- `student_verifications` and `admin_audit_logs`; this migration adds the
-- missing pieces rather than a second admin system:
--
--   * `admin_roles`  — the six operational roles in the spec, with a clear
--                      permission matrix, layered on top of the legacy enum
--                      grants so existing `platform_super_admin` rows keep
--                      working.
--   * audited RPCs   — every sensitive read/write goes through a SECURITY
--                      DEFINER function that checks the caller server-side.
--                      Hiding a button is never the security boundary.
--   * audit trail    — writes to `admin_audit_logs` are append-only (a trigger
--                      rejects UPDATE/DELETE) and only reachable through the
--                      audited functions.
--   * feature flags  — stored in `system_settings`, toggled only by a Super
--                      Admin, and read back by the app so a switch has a real
--                      effect.
--
-- Additive only. No student content is deleted or rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Operational roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  granted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_role_check CHECK (
    role IN ('super_admin', 'admin', 'moderator', 'department_admin', 'club_admin', 'support_admin')
  ),
  CONSTRAINT admin_roles_user_role_key UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS admin_roles_user_idx ON public.admin_roles(user_id);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Who is an administrator, and what may they do?
--    SECURITY DEFINER keeps these checks out of RLS recursion and makes them
--    the single authorization authority for every admin RPC.
-- ----------------------------------------------------------------------------
/**
 * The effective operational roles for the caller. Legacy enum grants from
 * migration 001 remain honoured, so an existing `university_admin` or
 * `platform_super_admin` does not lose access when this migration lands.
 */
CREATE OR REPLACE FUNCTION public.admin_role_names()
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH effective AS (
    SELECT ar.role
    FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
    UNION
    SELECT CASE ur.role
      WHEN 'platform_super_admin'    THEN 'super_admin'
      WHEN 'university_admin'        THEN 'admin'
      WHEN 'university_content_admin' THEN 'moderator'
      WHEN 'department_editor'       THEN 'department_admin'
      WHEN 'club_representative'     THEN 'club_admin'
    END
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'platform_super_admin', 'university_admin',
        'university_content_admin', 'department_editor', 'club_representative'
      )
  )
  SELECT COALESCE(array_agg(DISTINCT role), '{}')
  FROM effective
  WHERE role IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('university_admin', 'platform_super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'platform_super_admin'
    );
$$;

/**
 * The permission matrix. Keep this in one place so the app and the database
 * cannot drift: the app asks `admin_my_access()` for the same answers.
 */
CREATE OR REPLACE FUNCTION public.admin_can(permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  roles TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  roles := public.admin_role_names();

  RETURN CASE permission
    -- Platform-wide governance is reserved to the Super Admin.
    WHEN 'roles.manage'    THEN FALSE
    WHEN 'features.manage' THEN FALSE
    WHEN 'pages.manage'    THEN 'admin' = ANY(roles)
    -- People
    WHEN 'users.view'      THEN 'admin' = ANY(roles)
    WHEN 'users.verify'    THEN roles && ARRAY['admin', 'department_admin', 'support_admin']
    WHEN 'users.suspend'   THEN 'admin' = ANY(roles)
    -- Content, reports and Campus Pulse
    WHEN 'content.moderate' THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'club_admin']
    WHEN 'reports.resolve'  THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    WHEN 'pulse.monitor'    THEN roles && ARRAY['admin', 'moderator']
    WHEN 'audit.read'       THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    ELSE FALSE
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_require(permission TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can(permission) THEN
    RAISE EXCEPTION 'You do not have the % permission', permission
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Append-only audit trail
--    The existing table is kept; writes flow through admin_write_audit().
--    A trigger blocks UPDATE/DELETE so history cannot be rewritten from the
--    app, and no INSERT policy is created for clients.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Administrative audit records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_audit_immutable();

DROP POLICY IF EXISTS "Administrators can read the audit trail" ON public.admin_audit_logs;
CREATE POLICY "Administrators can read the audit trail"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin());

-- Existing legacy policy remains for university_admin rows; the new policy
-- covers the operational roles above.

CREATE OR REPLACE FUNCTION public.admin_actor_role()
RETURNS app_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  roles TEXT[];
BEGIN
  IF public.is_super_admin() THEN
    RETURN 'platform_super_admin'::app_role_enum;
  END IF;

  roles := public.admin_role_names();

  IF 'admin' = ANY(roles) THEN
    RETURN 'university_admin'::app_role_enum;
  END IF;
  IF 'department_admin' = ANY(roles) THEN
    RETURN 'department_editor'::app_role_enum;
  END IF;
  IF 'club_admin' = ANY(roles) THEN
    RETURN 'club_representative'::app_role_enum;
  END IF;

  RETURN 'university_content_admin'::app_role_enum;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_action       TEXT,
  p_table        TEXT,
  p_record_id    TEXT,
  p_reason       TEXT,
  p_diff         JSONB DEFAULT '{}'::jsonb,
  p_university   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id UUID;
  uni_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = 'insufficient_privilege';
  END IF;

  uni_id := p_university;
  IF uni_id IS NULL THEN
    SELECT COALESCE(
      (SELECT primary_university_id FROM public.profiles WHERE id = auth.uid()),
      (SELECT university_id FROM public.admin_roles WHERE user_id = auth.uid() AND university_id IS NOT NULL LIMIT 1),
      (SELECT id FROM public.universities ORDER BY created_at LIMIT 1)
    ) INTO uni_id;
  END IF;

  IF uni_id IS NULL THEN
    RAISE EXCEPTION 'No university is configured for this audit record';
  END IF;

  INSERT INTO public.admin_audit_logs (
    university_id, actor_id, actor_role, action_type, target_table,
    target_record_id, reason, diff_summary
  ) VALUES (
    uni_id, auth.uid(), public.admin_actor_role(), p_action, p_table,
    p_record_id, NULLIF(btrim(COALESCE(p_reason, '')), ''), COALESCE(p_diff, '{}'::jsonb)
  )
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Dashboard: real aggregates, honest gaps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
  storage_total BIGINT;
  storage_week BIGINT;
  storage_large BIGINT;
BEGIN
  PERFORM public.admin_require('audit.read');

  BEGIN
    SELECT COALESCE(SUM((o.metadata->>'size')::BIGINT), 0),
           COALESCE(SUM(CASE WHEN o.created_at > now() - interval '7 days'
                             THEN (o.metadata->>'size')::BIGINT ELSE 0 END), 0),
           COUNT(*) FILTER (WHERE (o.metadata->>'size')::BIGINT > 5 * 1024 * 1024)
      INTO storage_total, storage_week, storage_large
      FROM storage.objects o;
  EXCEPTION WHEN OTHERS THEN
    storage_total := NULL;
    storage_week := NULL;
    storage_large := NULL;
  END;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'people', jsonb_build_object(
      'registered_students', (SELECT COUNT(*) FROM public.profiles),
      'verified_students', (SELECT COUNT(*) FROM public.profiles WHERE is_verified_student),
      'suspended_accounts', (SELECT COUNT(*) FROM public.profiles WHERE is_suspended),
      'new_students_7d', (SELECT COUNT(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
      'active_30d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > now() - interval '30 days'),
      'unconfirmed_signups', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
      'administrators', (SELECT COUNT(DISTINCT user_id) FROM public.admin_roles)
    ),
    'content', jsonb_build_object(
      'posts', (SELECT COUNT(*) FROM public.posts WHERE NOT is_hidden),
      'comments', (SELECT COUNT(*) FROM public.comments),
      'reactions', (SELECT COUNT(*) FROM public.reactions),
      'pages', (SELECT COUNT(*) FROM public.pages WHERE is_active),
      'page_followers', (SELECT COUNT(*) FROM public.follows WHERE target_type = 'page'),
      'clubs', (SELECT COUNT(*) FROM public.organizations),
      'club_memberships', (SELECT COUNT(*) FROM public.organization_members WHERE membership_status = 'approved'),
      'events', (SELECT COUNT(*) FROM public.events),
      'marketplace_listings', (SELECT COUNT(*) FROM public.marketplace_listings),
      'room_listings', (SELECT COUNT(*) FROM public.roommate_listings),
      'launch_posts', (SELECT COUNT(*) FROM public.posts WHERE is_seed_content)
    ),
    'pulse', jsonb_build_object(
      'available_now', (SELECT COUNT(*) FROM public.campus_now_statuses WHERE expires_at > now()),
      'open_activities', (SELECT COUNT(*) FROM public.activity_plans WHERE starts_at > now() AND status = 'open'),
      'reported_activities', (
        SELECT COUNT(*) FROM public.reports r
        WHERE r.target_type = 'activity' AND r.status IN ('open', 'under_review')
      )
    ),
    'moderation', jsonb_build_object(
      'pending_reports', (SELECT COUNT(*) FROM public.reports WHERE status IN ('open', 'under_review')),
      'pending_student_verifications', (SELECT COUNT(*) FROM public.student_verifications WHERE status = 'pending'),
      'pending_club_verifications', (SELECT COUNT(*) FROM public.organization_verification_requests WHERE status = 'pending')
    ),
    'storage', jsonb_build_object(
      'bytes_total', storage_total,
      'bytes_uploaded_7d', storage_week,
      'large_files', storage_large
    ),
    'health', jsonb_build_object(
      'database_bytes', pg_database_size(current_database()),
      'server_time', now()
    ),
    'unavailable', jsonb_build_array(
      'Engagement rate — requires per-session analytics that is not collected.',
      'Failed uploads — upload failures are not logged yet.',
      'Precise location analytics — deliberately never collected.'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. People: search, verification, suspension, roles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  department_name TEXT,
  is_verified_student BOOLEAN,
  is_suspended BOOLEAN,
  roles TEXT[],
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('users.view');

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    au.email::TEXT,
    p.avatar_url,
    d.name,
    p.is_verified_student,
    p.is_suspended,
    public.admin_role_names_for(p.id),
    p.created_at,
    au.last_sign_in_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE p_query IS NULL
     OR btrim(p_query) = ''
     OR p.display_name ILIKE '%' || btrim(p_query) || '%'
     OR p.username ILIKE '%' || btrim(p_query) || '%'
     OR au.email ILIKE '%' || btrim(p_query) || '%'
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_role_names_for(target_user UUID)
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH effective AS (
    SELECT ar.role
    FROM public.admin_roles ar
    WHERE ar.user_id = target_user
    UNION
    SELECT CASE ur.role
      WHEN 'platform_super_admin'    THEN 'super_admin'
      WHEN 'university_admin'        THEN 'admin'
      WHEN 'university_content_admin' THEN 'moderator'
      WHEN 'department_editor'       THEN 'department_admin'
      WHEN 'club_representative'     THEN 'club_admin'
    END
    FROM public.user_roles ur
    WHERE ur.user_id = target_user
      AND ur.role IN (
        'platform_super_admin', 'university_admin',
        'university_content_admin', 'department_editor', 'club_representative'
      )
  )
  SELECT COALESCE(array_agg(DISTINCT role), '{}')
  FROM effective
  WHERE role IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_verification(
  p_user_id UUID,
  p_approve BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
  target_dept UUID;
  verification_id UUID;
BEGIN
  PERFORM public.admin_require('users.verify');

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Choose a student to review';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for verification decisions';
  END IF;

  SELECT primary_university_id, department_id INTO target_uni, target_dept
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  UPDATE public.profiles
     SET is_verified_student = p_approve
   WHERE id = p_user_id;

  SELECT id INTO verification_id
  FROM public.student_verifications
  WHERE user_id = p_user_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF verification_id IS NOT NULL THEN
    UPDATE public.student_verifications
       SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
           reviewed_by = auth.uid(),
           reviewed_at = now()
     WHERE id = verification_id;
  ELSE
    INSERT INTO public.student_verifications (
      user_id, university_id, verification_method, status, reviewed_by, reviewed_at
    ) VALUES (
      p_user_id, target_uni, 'manual_admin_review',
      CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      auth.uid(), now()
    )
    RETURNING id INTO verification_id;
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN p_approve THEN 'verification.approved' ELSE 'verification.rejected' END,
    'profiles', p_user_id::TEXT, p_reason,
    jsonb_build_object('verification_id', verification_id, 'department_id', target_dept),
    target_uni
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(
  p_user_id UUID,
  p_suspend BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('users.suspend');

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change an account status';
  END IF;

  SELECT primary_university_id INTO target_uni
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  UPDATE public.profiles SET is_suspended = p_suspend WHERE id = p_user_id;

  PERFORM public.admin_write_audit(
    CASE WHEN p_suspend THEN 'account.suspended' ELSE 'account.restored' END,
    'profiles', p_user_id::TEXT, p_reason,
    jsonb_build_object('suspended', p_suspend),
    target_uni
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_user_id UUID,
  p_role    TEXT,
  p_assign  BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can change administrative roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_role NOT IN ('super_admin', 'admin', 'moderator', 'department_admin', 'club_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Unknown administrative role: %', p_role;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change an administrative role';
  END IF;
  IF p_user_id = auth.uid() AND p_role = 'super_admin' AND NOT p_assign THEN
    RAISE EXCEPTION 'You cannot remove your own Super Admin role';
  END IF;

  SELECT primary_university_id INTO target_uni
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  IF p_assign THEN
    INSERT INTO public.admin_roles (user_id, role, university_id, granted_by, note)
    VALUES (p_user_id, p_role, target_uni, auth.uid(), p_reason)
    ON CONFLICT (user_id, role) DO nothing;
  ELSE
    DELETE FROM public.admin_roles WHERE user_id = p_user_id AND role = p_role;
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN p_assign THEN 'role.granted' ELSE 'role.revoked' END,
    'admin_roles', p_user_id::TEXT || ':' || p_role, p_reason,
    jsonb_build_object('role', p_role, 'assigned', p_assign),
    target_uni
  );
END;
$$;

-- The app uses this to decide which controls to render. It grants nothing.
CREATE OR REPLACE FUNCTION public.admin_my_access()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_admin', public.is_admin(),
    'is_super_admin', public.is_super_admin(),
    'roles', public.admin_role_names(),
    'permissions', jsonb_build_object(
      'roles.manage', public.admin_can('roles.manage'),
      'features.manage', public.admin_can('features.manage'),
      'pages.manage', public.admin_can('pages.manage'),
      'users.view', public.admin_can('users.view'),
      'users.verify', public.admin_can('users.verify'),
      'users.suspend', public.admin_can('users.suspend'),
      'content.moderate', public.admin_can('content.moderate'),
      'reports.resolve', public.admin_can('reports.resolve'),
      'pulse.monitor', public.admin_can('pulse.monitor'),
      'audit.read', public.admin_can('audit.read')
    )
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. Launch content: identify, filter, archive, restore
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_launch_content(
  p_batch TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body_preview TEXT,
  page_name TEXT,
  seed_batch TEXT,
  source_organization TEXT,
  source_url TEXT,
  content_rights TEXT,
  internal_reviewer TEXT,
  publication_status TEXT,
  is_hidden BOOLEAN,
  removal_eligible BOOLEAN,
  original_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    left(p.body, 240),
    pg.name,
    p.seed_batch,
    p.source_organization,
    p.source_url,
    p.content_rights,
    p.internal_reviewer,
    p.publication_status,
    p.is_hidden,
    p.removal_eligible,
    p.original_published_at,
    p.created_at
  FROM public.posts p
  LEFT JOIN public.pages pg ON pg.id = p.page_id
  WHERE p.is_seed_content = TRUE
    AND (p_batch IS NULL OR p_batch = '' OR p.seed_batch = p_batch)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_post(
  p_post_id UUID,
  p_action  TEXT,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_page UUID;
  target_seed BOOLEAN;
  target_eligible BOOLEAN;
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('content.moderate');

  IF p_action NOT IN ('hide', 'restore', 'archive') THEN
    RAISE EXCEPTION 'Unknown moderation action: %', p_action;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for every moderation action';
  END IF;

  SELECT page_id, is_seed_content, removal_eligible, university_id
    INTO target_page, target_seed, target_eligible, target_uni
  FROM public.posts WHERE id = p_post_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That post no longer exists';
  END IF;

  -- A club/department administrator may only moderate content on Pages they
  -- manage. Platform-level moderators and admins can act anywhere.
  IF NOT (public.is_super_admin() OR 'admin' = ANY(public.admin_role_names()) OR 'moderator' = ANY(public.admin_role_names()))
     AND NOT public.can_manage_page(target_page) THEN
    RAISE EXCEPTION 'You can only moderate content on Pages you manage'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action = 'archive' THEN
    IF NOT target_eligible AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'This item is protected from removal';
    END IF;
    UPDATE public.posts
       SET is_hidden = TRUE,
           publication_status = 'archived',
           updated_at = now()
     WHERE id = p_post_id;
  ELSIF p_action = 'hide' THEN
    UPDATE public.posts SET is_hidden = TRUE, updated_at = now() WHERE id = p_post_id;
  ELSE
    UPDATE public.posts
       SET is_hidden = FALSE,
           publication_status = 'published',
           updated_at = now()
     WHERE id = p_post_id;
  END IF;

  PERFORM public.admin_write_audit(
    'post.' || p_action,
    'posts', p_post_id::TEXT, p_reason,
    jsonb_build_object('is_seed_content', target_seed, 'page_id', target_page),
    target_uni
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Reports
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_reports(
  p_status TEXT DEFAULT NULL,
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  target_type TEXT,
  target_id TEXT,
  reason_category TEXT,
  details TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  reporter_name TEXT,
  reporter_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('reports.resolve');

  RETURN QUERY
  SELECT r.id, r.target_type, r.target_id, r.reason_category, r.details, r.status,
         r.created_at, p.display_name, p.username
  FROM public.reports r
  JOIN public.profiles p ON p.id = r.reporter_id
  WHERE p_status IS NULL OR p_status = '' OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id UUID,
  p_status    TEXT,
  p_reason    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('reports.resolve');

  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'A report can only be resolved or dismissed';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to close a report';
  END IF;

  SELECT university_id INTO target_uni FROM public.reports WHERE id = p_report_id;
  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That report no longer exists';
  END IF;

  UPDATE public.reports SET status = p_status WHERE id = p_report_id;

  INSERT INTO public.moderation_actions (report_id, moderator_id, action_taken, reason)
  VALUES (p_report_id, auth.uid(), p_status, p_reason);

  PERFORM public.admin_write_audit(
    'report.' || p_status,
    'reports', p_report_id::TEXT, p_reason, '{}'::jsonb, target_uni
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Feature flags + platform announcement
--    Only switches the app actually enforces are exposed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_feature_flags()
RETURNS TABLE (
  key TEXT,
  enabled BOOLEAN,
  updated_at TIMESTAMPTZ,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT f.key,
         COALESCE((s.value->>'enabled')::BOOLEAN, TRUE),
         s.updated_at,
         f.description
  FROM (VALUES
    ('campus_pulse', 'Campus Pulse — opt-in presence, activities and the Home/Circle strips'),
    ('marketplace', 'Marketplace — listings, saves and enquiries'),
    ('roommates', 'Room — roommate listings and enquiries'),
    ('stories', 'Campus Stories — reserved until the Stories surface ships')
  ) AS f(key, description)
  LEFT JOIN public.system_settings s ON s.key = 'feature.' || f.key
  ORDER BY f.key;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_feature(
  p_key     TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can change platform features'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_key NOT IN ('campus_pulse', 'marketplace', 'roommates', 'stories') THEN
    RAISE EXCEPTION 'Unknown feature key: %', p_key;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change a feature';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('feature.' || p_key, jsonb_build_object('enabled', p_enabled), now())
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_build_object('enabled', p_enabled), updated_at = now();

  PERFORM public.admin_write_audit(
    'feature.' || CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END,
    'system_settings', 'feature.' || p_key, p_reason,
    jsonb_build_object('enabled', p_enabled)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_announcement(
  p_message TEXT,
  p_active  BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can publish a platform announcement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_active AND NULLIF(btrim(COALESCE(p_message, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Write the announcement before switching it on';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('platform.announcement',
          jsonb_build_object('message', COALESCE(btrim(p_message), ''), 'active', p_active),
          now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.admin_write_audit(
    CASE WHEN p_active THEN 'announcement.published' ELSE 'announcement.cleared' END,
    'system_settings', 'platform.announcement', p_reason,
    jsonb_build_object('active', p_active)
  );
END;
$$;

/**
 * Public flags read by the student app. Deliberately limited to the switches
 * the app enforces, and never exposes administrative metadata.
 */
CREATE OR REPLACE FUNCTION public.platform_flags()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'campus_pulse', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.campus_pulse'), TRUE),
    'marketplace', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.marketplace'), TRUE),
    'roommates', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.roommates'), TRUE),
    'stories', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.stories'), FALSE),
    'announcement', (
      SELECT CASE WHEN COALESCE((value->>'active')::BOOLEAN, FALSE)
                  THEN jsonb_build_object('message', value->>'message')
                  ELSE NULL END
      FROM public.system_settings WHERE key = 'platform.announcement'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Audit list for the command centre
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action_type TEXT,
  target_table TEXT,
  target_record_id TEXT,
  reason TEXT,
  actor_name TEXT,
  actor_role app_role_enum,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT a.id, a.action_type, a.target_table, a.target_record_id, a.reason,
         COALESCE(p.display_name, 'Former administrator'), a.actor_role, a.created_at
  FROM public.admin_audit_logs a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Policies, grants and least privilege
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Administrators can read admin roles" ON public.admin_roles;
CREATE POLICY "Administrators can read admin roles"
  ON public.admin_roles FOR SELECT
  USING (public.is_admin());

-- system_settings previously had no RLS. Feature flags and the announcement
-- are readable only through `platform_flags()`; direct writes stay closed.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only administrators read raw settings" ON public.system_settings;
CREATE POLICY "Only administrators read raw settings"
  ON public.system_settings FOR SELECT
  USING (public.is_admin());

-- Function grants: authenticated only, never anon.
REVOKE ALL ON FUNCTION public.admin_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_search_users(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role_names_for(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_verification(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_role(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_my_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_launch_content(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_post(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_reports(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_feature_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_feature(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_announcement(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_audit(INT, INT) FROM PUBLIC;
-- Internal helpers: not callable from the API surface at all.
REVOKE ALL ON FUNCTION public.admin_write_audit(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_require(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_actor_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_can(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role_names() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_names_for(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_my_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_launch_content(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_feature_flags() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_feature(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_announcement(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_flags() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(INT, INT) TO authenticated;
-- admin_require/admin_can/is_admin are used inside the definer functions above;
-- they are not granted to clients directly. `admin_require` is also called by
-- functions that run as the same owner, so no client grant is needed.

COMMENT ON TABLE public.admin_roles IS
  'Operational administrative roles (PART 13). Writes go through admin_assign_role().';
COMMENT ON FUNCTION public.admin_dashboard() IS
  'Platform aggregates for the admin command centre. Real counts only; unavailable metrics are listed explicitly.';
COMMENT ON FUNCTION public.platform_flags() IS
  'The feature switches the student app enforces. Never exposes admin metadata.';

-- ============================================================
-- supabase/migrations/014_admin_permission_fix.sql
-- ============================================================

-- ============================================================================
-- NUB Connect — Admin permission matrix correction
-- ----------------------------------------------------------------------------
-- Migration 013 granted `users.verify` to Department Admins and Support Admins
-- but left `users.view` (the permission behind `admin_search_users()`) limited
-- to the `admin` role. Those staff could see a "review verification" action in
-- principle, yet could not find the student to act on.
--
-- This migration makes the matrix coherent: anyone who can review a student
-- can search for that student. It changes no data and grants no new role.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_can(permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  roles TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  roles := public.admin_role_names();

  RETURN CASE permission
    -- Platform-wide governance is reserved to the Super Admin.
    WHEN 'roles.manage'    THEN FALSE
    WHEN 'features.manage' THEN FALSE
    WHEN 'pages.manage'    THEN 'admin' = ANY(roles)
    -- People. Verification staff must be able to find the account they review.
    WHEN 'users.view'      THEN roles && ARRAY['admin', 'department_admin', 'support_admin']
    WHEN 'users.verify'    THEN roles && ARRAY['admin', 'department_admin', 'support_admin']
    WHEN 'users.suspend'   THEN 'admin' = ANY(roles)
    -- Content, reports and Campus Pulse
    WHEN 'content.moderate' THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'club_admin']
    WHEN 'reports.resolve'  THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    WHEN 'pulse.monitor'    THEN roles && ARRAY['admin', 'moderator']
    WHEN 'audit.read'       THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    ELSE FALSE
  END;
END;
$$;

COMMENT ON FUNCTION public.admin_can(TEXT) IS
  'Single permission matrix for the admin command centre. Verification staff can also search students.';

-- ============================================================
-- supabase/seed/launch_content.sql
-- ============================================================

-- ============================================================================
-- NUBCONNECT - Launch content
-- File: supabase/seed/launch_content.sql
--
-- A brand-new database must not look abandoned. This seed fills the platform
-- with content that is real, attributable and removable:
--
--   * 13 departments and 27 clubs - the institutional roster, taken from the
--     NUB Student Affairs and academic listings (nub.ac.bd, verified
--     2026-10-31).
--   * 12 official events - the published nub.ac.bd events feed, each with its
--     original article link.
--   * 34 launch posts published by the official "NUB Connect" Page: official
--     event announcements, campus photographs from the NUB gallery, department
--     and club spotlights, and the platform's own editorial posts.
--
-- Every launch post records where it came from, what rights its image
-- carries, who reviewed it, which seed batch it belongs to and whether it may
-- be archived later. Genuine student content is never marked as seed content,
-- so the owner can retire the launch set without touching real students.
--
-- Run this after the migrations. It is idempotent: re-running it updates the
-- same records instead of duplicating them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Departments - the verified institutional roster
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_uni UUID;
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  INSERT INTO public.departments
    (university_id, faculty_id, slug, code, name, semester_system, description,
     official_website, contact_email, source_url, verification_status)
  SELECT v_uni, f.id, lower(d.code), d.code, d.name, d.semester::semester_system_enum, d.description,
         d.website, 'info@nub.ac.bd', d.source_url, d.status::verification_status_enum
    FROM (VALUES
      ('science-engineering', 'CSE', 'Computer Science & Engineering', 'tri_semester',
       'Fosters skilled computing professionals through software engineering, algorithms, AI, database systems, cybersecurity, and hands-on capstone research.',
       'https://cse.nub.ac.bd/', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('science-engineering', 'EEE', 'Electrical & Electronic Engineering', 'tri_semester',
       'Undergraduate engineering education in power systems, electronics, telecommunications, embedded control systems, and renewable energy laboratories.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('science-engineering', 'TEXTILE', 'Textile Engineering', 'tri_semester',
       'Textile technology, wet processing, apparel engineering, and sustainable fibre innovation with dedicated labs.',
       'https://textile.nub.ac.bd/', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('science-engineering', 'CE', 'Civil Engineering', 'bi_semester',
       'Structural, geotechnical, transportation, and environmental engineering with field-based project learning.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('science-engineering', 'ME', 'Mechanical Engineering', 'bi_semester',
       'Thermodynamics, fluid mechanics, manufacturing processes, and mechatronics design studios.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('business', 'BBA', 'Business Administration', 'tri_semester',
       'Management, marketing, finance, and entrepreneurship education with case-based teaching.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('business', 'MBA', 'Master of Business Administration', 'tri_semester',
       'Graduate business education for working professionals with evening and weekend tracks.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('humanities-social-science', 'ENGLISH', 'English', 'tri_semester',
       'Literature, linguistics, and applied communication studies with a writing-centre culture.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('law', 'LAW', 'Law', 'bi_semester',
       'LL.B (Hons.) with mooting chambers, legal aid clinics, and jurisprudence seminars.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('health-science', 'PHARM', 'Pharmacy', 'bi_semester',
       'B.Pharm with medicinal chemistry, pharmacology labs, and hospital-attachment rotations.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('health-science', 'MPH', 'Public Health', 'tri_semester',
       'MPH with epidemiology, biostatistics, and field research in community health.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'officially_verified'),
      ('science-engineering', 'CIVIL-TECH', 'Civil Technology (Diploma)', 'tri_semester',
       'Diploma track in civil technology for technician-level engineering careers.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'department_verified'),
      ('business', 'BTHM', 'Tourism & Hospitality Management', 'tri_semester',
       'Hospitality operations, tourism economics, and event management studies.',
       'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', 'department_verified')
    ) AS d(faculty_slug, code, name, semester, description, website, source_url, status)
    JOIN public.faculties f ON f.university_id = v_uni AND f.slug = d.faculty_slug
  ON CONFLICT (university_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        semester_system = EXCLUDED.semester_system,
        official_website = EXCLUDED.official_website,
        source_url = EXCLUDED.source_url,
        verification_status = EXCLUDED.verification_status,
        last_verified_at = now();
END
$$;

-- ----------------------------------------------------------------------------
-- 2. Clubs - the verified Student Affairs roster
--    Names, categories and verification levels are source-tracked. Member
--    counts, committees and galleries are deliberately NOT seeded: they were
--    demonstration records, and a club page must not show invented people.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_uni UUID;
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  INSERT INTO public.organizations
    (university_id, slug, name, short_description, category, scope_type,
     verification_status, source_url, membership_open)
  SELECT v_uni, c.slug, c.name, c.short_description, c.category, c.scope::text,
         c.status::verification_status_enum, 'https://nub.ac.bd/', TRUE
    FROM (VALUES
      ('nubcc', 'NUB Computer Club (NUBCC)', 'Technology club listed on the NUB Student Affairs club roster.', 'Technology', 'department_specific', 'officially_verified'),
      ('nub-spots', 'NUB SPOTS Club', 'Sports club listed on the NUB Student Affairs club roster; verification pending Student Affairs sign-off.', 'Sports', 'university_wide', 'awaiting_verification'),
      ('film-photo', 'NUB Film & Photography Club', 'Film and photography club listed on the NUB Student Affairs club roster.', 'Arts', 'university_wide', 'recognized_organization'),
      ('debate-central', 'Debate and Public Speaking Club (Central)', 'Debate and public speaking club listed on the NUB Student Affairs club roster.', 'Academic', 'central', 'officially_verified'),
      ('environment', 'NUB Environment Club (University-Wide)', 'Environment club listed on the NUB Student Affairs club roster.', 'Volunteering', 'university_wide', 'officially_verified'),
      ('human-rights', 'Human Rights Club', 'Awareness club listed on the NUB Student Affairs club roster.', 'Awareness', 'university_wide', 'recognized_organization'),
      ('it-club', 'IT Club', 'IT club listed on the NUB Student Affairs club roster.', 'Technology', 'university_wide', 'recognized_organization'),
      ('business-society', 'NUB Business Society', 'Business club listed on the NUB Student Affairs club roster.', 'Business', 'university_wide', 'officially_verified'),
      ('games-sports', 'Games and Sports Club', 'Games and sports club listed on the NUB Student Affairs club roster.', 'Sports', 'university_wide', 'officially_verified'),
      ('lit-cultural', 'Literature and Cultural Club', 'Literature and cultural club listed on the NUB Student Affairs club roster.', 'Arts', 'central', 'officially_verified'),
      ('cse-club', 'CSE Club', 'Departmental CSE community listed on the NUB Student Affairs club roster.', 'Technology', 'department_specific', 'department_verified'),
      ('robotics', 'NUB Robotics Club', 'Robotics club listed on the NUB Student Affairs club roster.', 'Technology', 'university_wide', 'recognized_organization'),
      ('eee-club', 'EEE Club', 'Departmental EEE community listed on the NUB Student Affairs club roster.', 'Technology', 'department_specific', 'department_verified'),
      ('ncsd', 'Northern Centre for Skill Development (NCSD)', 'University-led skill development centre listed on the NUB Student Affairs club roster.', 'Skills', 'central', 'officially_verified'),
      ('textile-innovation', 'Textile Innovation Club', 'Departmental textile club listed on the NUB Student Affairs club roster.', 'Technology', 'department_specific', 'department_verified'),
      ('textile-sports', 'Textile Sports Club', 'Departmental textile sports club listed on the NUB Student Affairs club roster.', 'Sports', 'department_specific', 'department_verified'),
      ('textile-welfare', 'Textile Welfare Club', 'Departmental textile welfare club listed on the NUB Student Affairs club roster.', 'Volunteering', 'department_specific', 'department_verified'),
      ('nub-textile', 'NUB Textile Club', 'General textile departmental club listed on the NUB Student Affairs club roster.', 'Academic', 'department_specific', 'recognized_organization'),
      ('pharm-career', 'Pharmacy Career Counseling Club', 'Departmental pharmacy club listed on the NUB Student Affairs club roster.', 'Career', 'department_specific', 'department_verified'),
      ('pharm-health', 'Pharmacy Health Club', 'Departmental pharmacy health club listed on the NUB Student Affairs club roster.', 'Health', 'department_specific', 'department_verified'),
      ('law-mooting', 'Law Mooting & Debating Club', 'Departmental law club listed on the NUB Student Affairs club roster.', 'Academic', 'department_specific', 'officially_verified'),
      ('law-journalism', 'Law Journalism and Photography Club', 'Departmental law club listed on the NUB Student Affairs club roster.', 'Arts', 'department_specific', 'recognized_organization'),
      ('law-literature', 'NUB Association of Law and Literature', 'Departmental law association listed on the NUB Student Affairs club roster.', 'Academic', 'department_specific', 'recognized_organization'),
      ('business-entrepreneurship', 'Business Entrepreneurship and Leadership Club', 'Business club listed on the NUB Student Affairs club roster.', 'Business', 'university_wide', 'recognized_organization'),
      ('language', 'NUB Language Club', 'Language club listed on the NUB Student Affairs club roster.', 'Academic', 'university_wide', 'officially_verified'),
      ('career-placement', 'NUB Career & Placement Club', 'Career club listed on the NUB Student Affairs club roster.', 'Career', 'central', 'officially_verified'),
      ('social-welfare', 'NUB Central Social Welfare Club', 'Social welfare club listed on the NUB Student Affairs club roster.', 'Volunteering', 'central', 'officially_verified')
    ) AS c(slug, name, short_description, category, scope, status)
  ON CONFLICT (university_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        short_description = EXCLUDED.short_description,
        category = EXCLUDED.category,
        scope_type = EXCLUDED.scope_type,
        source_url = EXCLUDED.source_url;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Official events - the published nub.ac.bd feed
--    Titles and links are verbatim. The listing publishes no venue or start
--    time, so those fields say so rather than inventing one.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_uni UUID;
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  INSERT INTO public.events
    (university_id, title, description, event_date, venue_or_format,
     content_origin, verification_status, source_url)
  SELECT v_uni, e.title, e.description, e.event_date::date, e.venue,
         'official_university'::content_origin_enum, 'officially_verified'::verification_status_enum, e.source_url
    FROM (VALUES
      ('IQAC, NUB Organizes Seminar on Building a Globally Leading University', 'Official listing from the NUB events feed.', '2026-07-29', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/4y37ta6x/iqac-nub-organizes-seminar-on-building-a-globally-leading-university'),
      ('International Innovation Competition and Exhibition Held at Northern University', 'Official listing from the NUB events feed.', '2026-05-09', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/kDcxb9Pg/international-innovation-competition-and-exhibition-held-at-northern-university'),
      ('NUB Hosts Inter-University Friendly Debate Competition', 'Official listing from the NUB events feed.', '2026-04-29', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/5wtdmque/nub-hosts-inter-university-friendly-debate-competition'),
      ('NUB Film and Photography Club Hosts Freshers'' Reception 1.0: Lens Mate Meets', 'Official listing from the NUB events feed.', '2026-04-26', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/83fzxnau/nub-film-and-photography-club-hosts-%E2%80%9Cfreshers%E2%80%99-reception-1.0-lens-mate-meets'),
      ('Discussion Held at NUB on the Occasion of World Intellectual Property Day 2026', 'Official listing from the NUB events feed.', '2026-04-26', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/ydw0bl1h/discussion-held-at-nub-on-the-occasion-of-world-intellectual-property-day-2026'),
      ('Official Launch of the Debate and Public Speaking Club at NUB', 'Official listing from the NUB events feed.', '2026-04-26', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/o3lcjh2g/official-launch-of-the-debate-and-public-speaking-club-at-nub'),
      ('NUB CSE Six-a-Side Cricket Tournament 2026 Kicks Off with Festive Trophy Unveiling', 'Official listing from the NUB events feed.', '2026-04-22', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/7xpgpnvf/nub-cse-six-a-side-cricket-tournament-2026-kicks-off-with-festive-trophy-unveiling'),
      ('Northern University Bangladesh Celebrates Pohela Boishakh with Vibrant Cultural Festivities', 'Official listing from the NUB events feed.', '2026-04-18', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/cmzjyhhi/northern-university-bangladesh-celebrates-pohela-boishakh-with-vibrant-cultural-festivities'),
      ('Northern University holds discussion on Independence Day', 'Official listing from the NUB events feed.', '2026-03-28', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/kh5zbd3w/northern-university-holds-discussion-on-independence-day'),
      ('NUB Organizes Industrial Visit for Textile Department to Enhance Practical Knowledge and Industry Exposure', 'Official listing from the NUB events feed.', '2026-02-23', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/2vdmcfyy/nub-organizes-industrial-visit-for-textile-department-to-enhance-practical-knowledge-and-industry-exposure'),
      ('NUB Launches Tree Plantation Drive to Strengthen Environmental Sustainability', 'Official listing from the NUB events feed.', '2026-02-22', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/dxixuooj/nub-launches-tree-plantation-drive-to-strengthen-environmental-sustainability'),
      ('Northern University Bangladesh Observes International Mother Language Day with Profound Respect', 'Official listing from the NUB events feed.', '2026-02-21', 'Venue not published in the official listing', 'https://nub.ac.bd/nub/event/eyctmduq/northern-university-bangladesh-observes-international-mother-language-day-with-profound-respect')
    ) AS e(title, description, event_date, venue, source_url)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.events ev
     WHERE ev.university_id = v_uni AND ev.source_url = e.source_url
  );
END
$$;

-- ----------------------------------------------------------------------------
-- 4. Launch posts by the official NUB Connect Page
--    Every row carries its provenance. The seed batch identifier lets the
--    Launch Content Manager find this set later without touching real posts.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_uni     UUID;
  v_page    UUID;
  v_author  UUID;
  v_batch   TEXT := 'launch-2026-11';
  v_reviewer TEXT := 'NUB Connect platform team';
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;
  SELECT id INTO v_page FROM public.pages WHERE university_id = v_uni AND slug = 'nub-connect' LIMIT 1;
  SELECT id INTO v_author FROM public.profiles WHERE username = 'nub-connect-official' LIMIT 1;

  IF v_page IS NULL OR v_author IS NULL THEN
    RAISE NOTICE 'launch_content: NUB Connect Page not present - skipping launch posts.';
    RETURN;
  END IF;

  -- 4a. The platform's own editorial posts.
  INSERT INTO public.posts
    (university_id, author_id, page_id, content_origin, category, title, body, visibility,
     is_seed_content, seed_batch, source_url, source_organization, original_published_at,
     image_source, content_rights, internal_reviewer, publication_status, published_at,
     removal_eligible, created_at, updated_at)
  SELECT v_uni, v_author, v_page, p.origin::content_origin_enum, p.category, p.title, p.body,
         'university', TRUE, v_batch, p.source_url, p.source_org, p.original_date::timestamptz,
         p.image_source, p.rights, v_reviewer, 'published', p.published_at::timestamptz,
         TRUE, p.published_at::timestamptz, p.published_at::timestamptz
    FROM (VALUES
      ('official_university', 'announcement', 'Welcome to NUB Connect',
       'NUB Connect is the campus network for Northern University Bangladesh - one place to find the people around you, join the communities you care about, and keep up with what is happening on campus.

Start with your profile, follow a few classmates, and say hello. Everything you post here stays on your campus.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-16 09:00:00'),
      ('official_university', 'announcement', 'What NUB Connect is - and what it is not',
       'NUB Connect is a social network for students of Northern University Bangladesh. It is not a notice board, not an ERP, and not a place where staff speak to students through anonymous accounts.

Everything official on this platform is published by a verified Page, and everything else is published by a real student under their own name. You can always tell which is which.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-18 09:00:00'),
      ('official_university', 'announcement', 'Find the people around you',
       'Campus Pulse shows who is around campus and who is free to talk - but only students who choose to share that. Availability expires on its own, nothing tracks your location, and being signed in never means you are physically on campus.

Turn it on when it suits you, and turn it off when it does not.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-20 09:00:00'),
      ('official_university', 'announcement', 'Find your circle',
       'Circle is where communities live: interest groups, department communities, university clubs and course groups. Join a club, apply to a community, and their discussions and activities appear in your feed.

Your campus roster of verified clubs is published here, and each club page is managed by its own elected committee.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-22 09:00:00'),
      ('official_university', 'announcement', 'Start a conversation',
       'Messages on NUB Connect are private. If someone you do not know messages you, they send a request first and you decide whether to accept it. You can block, mute or report at any time.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-24 09:00:00'),
      ('official_university', 'announcement', 'NUB Verified is separate from having an account',
       'Creating an account does not make you a verified NUB student. Verification is a separate review by university staff, and until it is granted your profile shows as an unverified student account.

Verification is what lets you message verified students directly, and it is never something an account can grant itself.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-26 09:00:00'),
      ('official_university', 'announcement', 'Share your campus - photos only, and only your own',
       'The feed is built around photographs. Post what you saw, tag the community it belongs to, and choose who can see it: your university, your department, or your circles.

Please share only photographs you took yourself, and never post anyone else''s private information.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-28 09:00:00'),
      ('official_university', 'question', 'What should NUB Connect answer first?',
       'The platform is young and the student community decides what it becomes. Which problem on campus should this app solve first - finding study partners, finding a flat, finding people to join a club with, or something else entirely?',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-10-30 09:00:00'),
      ('official_university', 'announcement', 'Looking for a room, or a roommate?',
       'The Room section lists flats, shared rooms, hostels and mess places, and it separates finding a place from finding a person to share one with. Addresses and phone numbers are never published - enquiries go through the platform.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-11-01 09:00:00'),
      ('official_university', 'announcement', 'Buy, sell and swap on campus',
       'The Marketplace is for student-to-student trade: books, electronics, furniture, sports gear and more. Listings carry a real photograph, a price in taka and the general pickup area - never a personal address.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-11-03 09:00:00'),
      ('official_university', 'announcement', 'Your Campus Passport',
       'Every club you join, every activity you take part in and every contribution you are recognised for is recorded on your Passport. Your membership cards carry a QR code that anyone can scan to confirm they are real.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-11-05 09:00:00'),
      ('official_university', 'announcement', 'Academic tools, on the verified NUB scale',
       'The Academic Hub uses the verified NUB 4.00 grading scale for its GPA and CGPA estimators, and publishes the semester calendar for tri-semester and bi-semester students. Results are unofficial student estimates until the university publishes the real transcript.',
       NULL, 'NUB Connect', NULL, NULL, 'original', '2026-11-07 09:00:00')
    ) AS p(origin, category, title, body, source_url, source_org, original_date, image_source, rights, published_at)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.posts po
     WHERE po.seed_batch = v_batch AND po.title = p.title AND po.is_seed_content
  );

  -- 4b. Official event announcements, each linking to the original article.
  INSERT INTO public.posts
    (university_id, author_id, page_id, content_origin, category, title, body, visibility,
     is_seed_content, seed_batch, source_url, source_organization, original_published_at,
     image_source, content_rights, internal_reviewer, publication_status, published_at,
     removal_eligible, created_at, updated_at)
  SELECT v_uni, v_author, v_page, 'official_university', 'announcement', e.title,
         'Official listing from the Northern University Bangladesh events feed.' || E'\n\n' ||
         'Read the original announcement on nub.ac.bd for the full detail, including anything the listing does not publish here.',
         'university', TRUE, v_batch, e.source_url, 'Northern University Bangladesh (nub.ac.bd)',
         e.event_date::timestamptz, NULL, 'official-public-website', v_reviewer, 'published',
         (e.event_date::timestamp + INTERVAL '18 hours'), TRUE,
         (e.event_date::timestamp + INTERVAL '18 hours'), (e.event_date::timestamp + INTERVAL '18 hours')
    FROM (VALUES
      ('IQAC, NUB Organizes Seminar on Building a Globally Leading University', '2026-07-29', 'https://nub.ac.bd/nub/event/4y37ta6x/iqac-nub-organizes-seminar-on-building-a-globally-leading-university'),
      ('International Innovation Competition and Exhibition Held at Northern University', '2026-05-09', 'https://nub.ac.bd/nub/event/kDcxb9Pg/international-innovation-competition-and-exhibition-held-at-northern-university'),
      ('NUB Hosts Inter-University Friendly Debate Competition', '2026-04-29', 'https://nub.ac.bd/nub/event/5wtdmque/nub-hosts-inter-university-friendly-debate-competition'),
      ('NUB Film and Photography Club Hosts Freshers'' Reception 1.0: Lens Mate Meets', '2026-04-26', 'https://nub.ac.bd/nub/event/83fzxnau/nub-film-and-photography-club-hosts-%E2%80%9Cfreshers%E2%80%99-reception-1.0-lens-mate-meets'),
      ('Discussion Held at NUB on the Occasion of World Intellectual Property Day 2026', '2026-04-26', 'https://nub.ac.bd/nub/event/ydw0bl1h/discussion-held-at-nub-on-the-occasion-of-world-intellectual-property-day-2026'),
      ('Official Launch of the Debate and Public Speaking Club at NUB', '2026-04-26', 'https://nub.ac.bd/nub/event/o3lcjh2g/official-launch-of-the-debate-and-public-speaking-club-at-nub'),
      ('NUB CSE Six-a-Side Cricket Tournament 2026 Kicks Off with Festive Trophy Unveiling', '2026-04-22', 'https://nub.ac.bd/nub/event/7xpgpnvf/nub-cse-six-a-side-cricket-tournament-2026-kicks-off-with-festive-trophy-unveiling'),
      ('Northern University Bangladesh Celebrates Pohela Boishakh with Vibrant Cultural Festivities', '2026-04-18', 'https://nub.ac.bd/nub/event/cmzjyhhi/northern-university-bangladesh-celebrates-pohela-boishakh-with-vibrant-cultural-festivities'),
      ('Northern University holds discussion on Independence Day', '2026-03-28', 'https://nub.ac.bd/nub/event/kh5zbd3w/northern-university-holds-discussion-on-independence-day'),
      ('NUB Organizes Industrial Visit for Textile Department to Enhance Practical Knowledge and Industry Exposure', '2026-02-23', 'https://nub.ac.bd/nub/event/2vdmcfyy/nub-organizes-industrial-visit-for-textile-department-to-enhance-practical-knowledge-and-industry-exposure'),
      ('NUB Launches Tree Plantation Drive to Strengthen Environmental Sustainability', '2026-02-22', 'https://nub.ac.bd/nub/event/dxixuooj/nub-launches-tree-plantation-drive-to-strengthen-environmental-sustainability'),
      ('Northern University Bangladesh Observes International Mother Language Day with Profound Respect', '2026-02-21', 'https://nub.ac.bd/nub/event/eyctmduq/northern-university-bangladesh-observes-international-mother-language-day-with-profound-respect')
    ) AS e(title, event_date, source_url)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.posts po
     WHERE po.seed_batch = v_batch AND po.source_url = e.source_url AND po.is_seed_content
  );

  -- 4c. Campus photographs from the official NUB gallery.
  INSERT INTO public.posts
    (university_id, author_id, page_id, content_origin, category, title, body, visibility,
     is_seed_content, seed_batch, source_url, source_organization, original_published_at,
     image_source, content_rights, internal_reviewer, publication_status, published_at,
     removal_eligible, created_at, updated_at)
  SELECT v_uni, v_author, v_page, 'official_university', 'photo', p.title, p.body,
         'university', TRUE, v_batch, p.source_url, 'Northern University Bangladesh (nub.ac.bd)',
         NULL, p.image_source, 'official-public-website', v_reviewer, 'published',
         p.published_at::timestamptz, TRUE, p.published_at::timestamptz, p.published_at::timestamptz
    FROM (VALUES
      ('Permanent Campus', 'Photographs from the official NUB gallery. Formal redistribution permission should be confirmed with the university before a production launch.', 'https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus', '/assets/nub/campus-permanent-1.jpg', '2026-11-08 09:00:00'),
      ('Basanta Utsav 2024', 'Photographs from the official NUB gallery. Formal redistribution permission should be confirmed with the university before a production launch.', 'https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024', '/assets/nub/basanta-utsav-1.jpg', '2026-11-09 09:00:00'),
      ('3rd Convocation 2015', 'Photographs from the official NUB gallery. Formal redistribution permission should be confirmed with the university before a production launch.', 'https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015', '/assets/nub/convocation-2015-1.jpg', '2026-11-10 09:00:00'),
      ('Graduation Dinner (Law)', 'Photographs from the official NUB gallery. Formal redistribution permission should be confirmed with the university before a production launch.', 'https://nub.ac.bd/gallery/picture/rnlp7vqn/graduation-dinner', '/assets/nub/graduation-dinner-law.jpg', '2026-11-11 09:00:00')
    ) AS p(title, body, source_url, image_source, published_at)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.posts po
     WHERE po.seed_batch = v_batch AND po.source_url = p.source_url AND po.is_seed_content
  );

  -- The photographs themselves.
  INSERT INTO public.post_media (post_id, media_url, media_type)
  SELECT po.id, m.media_url, 'image'
    FROM (VALUES
      ('https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus', '/assets/nub/campus-permanent-1.jpg'),
      ('https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus', '/assets/nub/campus-permanent-2.jpg'),
      ('https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024', '/assets/nub/basanta-utsav-1.jpg'),
      ('https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024', '/assets/nub/basanta-utsav-2.jpg'),
      ('https://nub.ac.bd/gallery/picture/a8f2ewln/basanta-utsav-2024', '/assets/nub/basanta-utsav-3.jpg'),
      ('https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015', '/assets/nub/convocation-2015-1.jpg'),
      ('https://nub.ac.bd/gallery/picture/lphkszu8/3rd-convocation-2015', '/assets/nub/convocation-2015-2.jpg'),
      ('https://nub.ac.bd/gallery/picture/rnlp7vqn/graduation-dinner', '/assets/nub/graduation-dinner-law.jpg')
    ) AS m(source_url, media_url)
    JOIN public.posts po
      ON po.seed_batch = v_batch AND po.source_url = m.source_url AND po.is_seed_content
  WHERE NOT EXISTS (
    SELECT 1 FROM public.post_media pm
     WHERE pm.post_id = po.id AND pm.media_url = m.media_url
  );

  -- 4d. Department spotlights, from the published academic listings.
  INSERT INTO public.posts
    (university_id, author_id, page_id, department_id, content_origin, category, title, body, visibility,
     is_seed_content, seed_batch, source_url, source_organization, original_published_at,
     image_source, content_rights, internal_reviewer, publication_status, published_at,
     removal_eligible, created_at, updated_at)
  SELECT v_uni, v_author, v_page, d.id, 'department_published', 'announcement', d.name || ' - ' || p.faculty_name,
         p.description || E'\n\nProgramme listings and semester rules are published on the university academic pages; the source link is on the department page.',
         'university', TRUE, v_batch, p.source_url, 'Northern University Bangladesh (nub.ac.bd)',
         NULL, NULL, 'official-public-website', v_reviewer, 'published',
         p.published_at::timestamptz, TRUE, p.published_at::timestamptz, p.published_at::timestamptz
    FROM (VALUES
      ('CSE', 'Computer Science & Engineering', 'Faculty of Science & Engineering', 'Fosters skilled computing professionals through software engineering, algorithms, AI, database systems, cybersecurity, and hands-on capstone research.', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-11-02 09:00:00'),
      ('BBA', 'Business Administration', 'Faculty of Business', 'Management, marketing, finance, and entrepreneurship education with case-based teaching.', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-11-04 09:00:00'),
      ('LAW', 'Law', 'Faculty of Law', 'LL.B (Hons.) with mooting chambers, legal aid clinics, and jurisprudence seminars.', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-11-06 09:00:00'),
      ('PHARM', 'Pharmacy', 'Faculty of Health Science', 'B.Pharm with medicinal chemistry, pharmacology labs, and hospital-attachment rotations.', 'https://nub.ac.bd/academic/t3gwthgw/academic-programs', '2026-11-12 09:00:00')
    ) AS p(code, name, faculty_name, description, source_url, published_at)
    JOIN public.departments d
      ON d.university_id = v_uni AND d.code = p.code
  WHERE NOT EXISTS (
    SELECT 1 FROM public.posts po
     WHERE po.seed_batch = v_batch AND po.title = p.name || ' - ' || p.faculty_name AND po.is_seed_content
  );

  -- 4e. Club spotlights, from the verified Student Affairs roster.
  INSERT INTO public.posts
    (university_id, author_id, page_id, organization_id, content_origin, category, title, body, visibility,
     is_seed_content, seed_batch, source_url, source_organization, original_published_at,
     image_source, content_rights, internal_reviewer, publication_status, published_at,
     removal_eligible, created_at, updated_at)
  SELECT v_uni, v_author, v_page, o.id, 'verified_club', 'announcement', o.name,
         o.short_description || E'\n\nThe club is listed on the NUB Student Affairs club roster. Members join from the club page, and the club''s elected committee manages its page.',
         'university', TRUE, v_batch, 'https://nub.ac.bd/', 'NUB Student Affairs club roster',
         NULL, NULL, 'official-public-website', v_reviewer, 'published',
         p.published_at::timestamptz, TRUE, p.published_at::timestamptz, p.published_at::timestamptz
    FROM (VALUES
      ('nubcc', '2026-11-09 09:00:00'),
      ('film-photo', '2026-11-13 09:00:00')
    ) AS p(slug, published_at)
    JOIN public.organizations o
      ON o.university_id = v_uni AND o.slug = p.slug
  WHERE NOT EXISTS (
    SELECT 1 FROM public.posts po
     WHERE po.seed_batch = v_batch AND po.organization_id = o.id AND po.is_seed_content
  );

  RAISE NOTICE 'launch_content: seed batch % published.', v_batch;
END
$$;
