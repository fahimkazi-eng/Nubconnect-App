// ============================================================================
// CAMPUS ORBIT — public membership card verification (§7.6) — server page.
// Thin server wrapper: exports the route's metadata (the card lookup itself
// is client-side demo state) and hands the token to the client half.
// ============================================================================
import type { Metadata } from 'next';
import VerifyCardClient from './VerifyCardClient';

export const metadata: Metadata = {
  title: 'Verify membership card',
  description:
    'Public read-only verification for NUBCONNECT club membership cards. Shows only what is printed on the card.',
};

export default async function VerifyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VerifyCardClient token={token} />;
}
