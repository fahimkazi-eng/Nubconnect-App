import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campus Honours',
  description:
    'Recognition for real campus contributions — transparent criteria, six categories, always opt-out.',
};

export default function HonoursLayout({ children }: { children: React.ReactNode }) {
  return children;
}
