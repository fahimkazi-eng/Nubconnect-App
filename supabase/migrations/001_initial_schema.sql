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
