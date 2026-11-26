import type { Metadata } from 'next';

// Bare chrome: routes that render outside the app shell (public verification).
export const metadata: Metadata = {
  title: 'Verify',
  robots: { index: false },
};

export default function BareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
