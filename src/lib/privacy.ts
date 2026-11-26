// ============================================================================
// NUBCONNECT — Privacy helpers (pure, unit-tested)
// Roommate privacy: exact residential addresses and phone numbers are never
// shown publicly. Enquiries route through the platform instead.
// ============================================================================

/** Mask a phone number for any public surface: 017XX-XXXX61 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•••';
  return `${digits.slice(0, 4)}••-••••${digits.slice(-2)}`;
}

/** Strip an exact address down to its general area only. */
export function generalAreaOnly(address: string): string {
  // Keep up to the first comma-group and drop house/road/plot numbers.
  const firstPart = address.split(',')[0] ?? address;
  return firstPart
    .replace(/\d+\/?\d*\s*(Kawlar|Jame|Mosjid)?/i, '')
    .replace(/\b(road|rd|lane|ln|plot|block|house|holding)\b\s*\S*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** True when a listing may be shown publicly (no full address or phone inside). */
export function isPublishableListing(listing: { area: string; description: string }): boolean {
  const blob = `${listing.area} ${listing.description}`;
  const hasPhone = /(\+880|0)1[3-9]\d{8}/.test(blob.replace(/[\s-]/g, ''));
  const hasHouse = /\b\d{1,3}\/\d{1,3}\b/.test(blob);
  return !hasPhone && !hasHouse;
}

/** Conversation must never start until the recipient's consent policy allows it. */
export function canMessage(
  recipient: { allowMessages: 'Anyone' | 'University Students Only' | 'Consent Requests Only' },
  senderIsVerifiedStudent: boolean,
): 'open' | 'request' | 'blocked' {
  if (recipient.allowMessages === 'Anyone') return 'open';
  if (recipient.allowMessages === 'University Students Only') {
    return senderIsVerifiedStudent ? 'open' : 'blocked';
  }
  return 'request';
}
