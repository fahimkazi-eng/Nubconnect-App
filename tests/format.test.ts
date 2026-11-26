// ============================================================================
// NUBCONNECT — format.ts unit tests
// ৳ currency, relative time, initials, plurals and deterministic scene seeds.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { taka, timeAgo, initials, pluralize, hashSeed, pick } from '@/lib/format';

describe('taka', () => {
  it('formats Bangladeshi taka with Indian-style grouping', () => {
    expect(taka(650)).toBe('৳650');
    expect(taka(4200)).toBe('৳4,200');
    expect(taka(120000)).toBe('৳1,20,000');
  });
});

describe('timeAgo', () => {
  it('describes recent moments', () => {
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 90_000).toISOString())).toBe('1m ago');
    expect(timeAgo(new Date(Date.now() - 90 * 60_000).toISOString())).toBe('1h ago');
    expect(timeAgo(new Date(Date.now() - 25 * 3_600_000).toISOString())).toBe('1d ago');
  });

  it('falls back to a date beyond a week', () => {
    const result = timeAgo(new Date(Date.now() - 8 * 86_400_000).toISOString());
    expect(result).toMatch(/^\d{1,2} \w{3}$/);
  });

  it('returns an empty string for invalid input', () => {
    expect(timeAgo('not-a-date')).toBe('');
  });
});

describe('initials', () => {
  it('takes the first two words', () => {
    expect(initials('Tasnim Rahman')).toBe('TR');
    expect(initials('Mahmudul Hasan Rakib')).toBe('MH');
  });

  it('handles single names and extra whitespace', () => {
    expect(initials('Nusrat')).toBe('N');
    expect(initials('  spaced   out  ')).toBe('SO');
  });
});

describe('pluralize', () => {
  it('uses the singular for one and plural otherwise', () => {
    expect(pluralize(1, 'view')).toBe('1 view');
    expect(pluralize(5, 'view')).toBe('5 views');
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
  });
});

describe('scene seeds (deterministic art)', () => {
  it('hashes the same seed to the same value', () => {
    expect(hashSeed('rm-1')).toBe(hashSeed('rm-1'));
    expect(hashSeed('rm-1')).not.toBe(hashSeed('rm-2'));
  });

  it('picks a stable element for a seed', () => {
    const palette = ['a', 'b', 'c', 'd'] as const;
    expect(pick(palette, 'post-9')).toBe(pick(palette, 'post-9'));
    expect(palette).toContain(pick(palette, 'post-9'));
  });
});
