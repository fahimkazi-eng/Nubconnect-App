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
