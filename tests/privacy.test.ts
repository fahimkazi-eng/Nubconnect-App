// ============================================================================
// NUBCONNECT — privacy.ts unit tests
// Roommate privacy contract: exact addresses and phone numbers are never
// public; messaging respects the recipient's consent policy.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { maskPhone, generalAreaOnly, isPublishableListing, canMessage } from '@/lib/privacy';

describe('maskPhone', () => {
  it('keeps only the first four and last two digits', () => {
    expect(maskPhone('01712-345678')).toBe('0171••-••••78');
    expect(maskPhone('+880 1712 345 678')).toBe('8801••-••••78');
  });

  it('masks numbers in local spacing variants', () => {
    expect(maskPhone('01712345678')).toBe('0171••-••••78');
  });

  it('refuses to reveal fragments of too-short input', () => {
    expect(maskPhone('017')).toBe('•••');
    expect(maskPhone('')).toBe('•••');
  });
});

describe('generalAreaOnly', () => {
  it('keeps the general area (first comma-group) and drops house/road identifiers after it', () => {
    // Trailing numbers are stripped too — the helper fails closed rather
    // than risking a house/plot number leaking into a public surface.
    expect(generalAreaOnly('Nikunja 2, House 14/5, Road 7, Dhaka')).toBe('Nikunja');
  });

  it('fails closed — strips road and holding details instead of leaking them', () => {
    const area = generalAreaOnly('House 14/5 Road 7, Nikunja 2');
    expect(area).not.toContain('14/5');
    expect(area).not.toContain('House');
    expect(area).not.toContain('Road');
  });
});

describe('isPublishableListing', () => {
  it('accepts a listing with only a general area', () => {
    expect(
      isPublishableListing({
        area: 'Nikunja 2',
        description: 'One seat available in a three-bedroom student flat near the campus gate.',
      }),
    ).toBe(true);
  });

  it('rejects Bangladeshi mobile numbers in any common format', () => {
    for (const description of [
      'Call me at 01712345678.',
      'Call me at 01712-345678.',
      'Call me at +8801712345678.',
    ]) {
      expect(isPublishableListing({ area: 'Nikunja 2', description })).toBe(false);
    }
  });

  it('rejects exact house/holding fractions', () => {
    expect(
      isPublishableListing({
        area: 'Nikunja 2',
        description: 'Find us at holding 12/5, second floor.',
      }),
    ).toBe(false);
  });
});

describe('canMessage (recipient consent policy)', () => {
  it('opens messaging when the recipient allows anyone', () => {
    expect(canMessage({ allowMessages: 'Anyone' }, false)).toBe('open');
    expect(canMessage({ allowMessages: 'Anyone' }, true)).toBe('open');
  });

  it('gates University Students Only behind verified status', () => {
    expect(canMessage({ allowMessages: 'University Students Only' }, true)).toBe('open');
    expect(canMessage({ allowMessages: 'University Students Only' }, false)).toBe('blocked');
  });

  it('always routes Consent Requests Only through a request', () => {
    expect(canMessage({ allowMessages: 'Consent Requests Only' }, true)).toBe('request');
    expect(canMessage({ allowMessages: 'Consent Requests Only' }, false)).toBe('request');
  });
});
