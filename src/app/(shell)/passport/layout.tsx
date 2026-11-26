import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campus Passport',
  description:
    'Your campus story in stamps — club membership cards with verification QRs and stamps you earned by being here.',
};

export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
