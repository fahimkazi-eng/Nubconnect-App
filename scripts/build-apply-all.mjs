#!/usr/bin/env node
// ============================================================================
// NUBCONNECT — Regenerate supabase/apply_all.sql
//
//   node scripts/build-apply-all.mjs
//
// apply_all.sql is the one-shot schema bundle: every migration plus the
// verified NUB tenant seed, concatenated in dependency order so a fresh
// Supabase project can be brought up with a single paste into the SQL
// editor.
//
// It is generated, never hand-edited, so it can never drift away from the
// migration files it is built from.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Dependency order. The seed runs after 002 (RLS) and before 003, because the
// later migrations add tables the seeded tenant rows reference.
const SOURCES = [
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_rls_policies.sql',
  'supabase/seed/seed_nub.sql',
  'supabase/migrations/003_social_experience.sql',
  'supabase/migrations/004_campus_orbit.sql',
  'supabase/migrations/005_campus_pulse.sql',
  'supabase/migrations/006_student_accounts.sql',
  'supabase/migrations/007_messaging.sql',
  'supabase/migrations/008_clubs_recognition.sql',
  'supabase/migrations/009_auth_user_defaults.sql',
  'supabase/migrations/010_real_feed.sql',
  'supabase/migrations/011_pages_and_provenance.sql',
  'supabase/migrations/012_campus_pulse.sql',
  'supabase/migrations/013_admin_command_centre.sql',
  'supabase/migrations/014_admin_permission_fix.sql',
  'supabase/seed/launch_content.sql',
];

const banner = (source) =>
  ['-- ============================================================', `-- ${source}`, '-- ============================================================', ''].join('\n');

const parts = [
  '',
  '-- GENERATED FILE — do not edit.',
  '-- Rebuild with: node scripts/build-apply-all.mjs',
  '--',
  '-- NUBCONNECT schema bundle: every migration in dependency order, followed',
  '-- by the verified Northern University Bangladesh tenant seed.',
  '-- Safe to run on a fresh Supabase project. Re-running is safe: every part',
  '-- is written to be idempotent and no part deletes production rows.',
  '',
];

for (const source of SOURCES) {
  const body = readFileSync(join(root, source), 'utf8').replace(/\s+$/, '');
  parts.push(banner(source), body, '');
}

const out = join(root, 'supabase/apply_all.sql');
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`wrote ${out} (${SOURCES.length} sources)`);
