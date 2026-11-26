// ============================================================================
// NUBCONNECT — public-first landing & official roster contract
//
// The root route is the only guaranteed-public page. It must:
//  • never redirect to sign-in;
//  • never import demo/fixture data;
//  • present real, attributable NUB content (official events feed and the
//    verified institutional roster);
//  • offer the honest click-through to auth for protected areas.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NUB_CLUBS, NUB_DEPARTMENTS, ROSTER_SOURCE } from '@/lib/institutionalRoster';
import { REAL_EVENTS } from '@/lib/nubEvents';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('public landing page (src/app/page.tsx)', () => {
  const page = read('src/app/page.tsx');

  it('does not force-redirect visitors to sign-in', () => {
    expect(page).not.toMatch(/redirect\(/);
  });

  it('never imports demo or fixture data', () => {
    expect(page).not.toMatch(/DEMO_[A-Z_]+/);
    expect(page).not.toContain('@/lib/demo/dataset');
    expect(page).not.toContain("from './demo/dataset'");
  });

  it('offers the honest sign-in click-through for protected areas', () => {
    expect(page).toContain('/auth/login');
    expect(page).toContain('next=');
    expect(page).toContain('/auth/register');
  });

  it('marks official event content with its source', () => {
    expect(page).toContain('nub.ac.bd');
    expect(page).toContain('REAL_EVENTS');
    expect(page).toContain('Official');
  });
});

describe('institutional roster data', () => {
  it('carries the verified NUB roster with attribution', () => {
    expect(ROSTER_SOURCE.href).toContain('nub.ac.bd');
    // 13 departments and 27 clubs, matching supabase/seed/launch_content.sql.
    expect(NUB_DEPARTMENTS).toHaveLength(13);
    expect(NUB_CLUBS).toHaveLength(27);
    for (const d of NUB_DEPARTMENTS) {
      expect(['Tri-Semester', 'Bi-Semester']).toContain(d.semester);
      expect(d.code.length).toBeGreaterThan(0);
    }
  });

  it('every official event carries a nub.ac.bd source URL', () => {
    expect(REAL_EVENTS.length).toBeGreaterThan(0);
    for (const e of REAL_EVENTS) {
      expect(e.sourceUrl).toContain('nub.ac.bd');
      expect(e.isDemo).toBe(false);
    }
  });
});

describe('route protection stays intact', () => {
  it('guests are still redirected away from private app routes', () => {
    const middleware = read('src/lib/supabase/middleware.ts');
    for (const prefix of ['/home', '/messages', '/marketplace', '/roommates', '/settings']) {
      expect(middleware).toContain(`'${prefix}'`);
    }
  });
});
