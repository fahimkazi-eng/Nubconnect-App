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
