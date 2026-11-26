import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lost & Found',
  description: 'Campus lost-and-found — claims happen through private messages, never public phone numbers.',
};

export default function LostFoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
