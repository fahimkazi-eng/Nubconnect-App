import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'More',
  description: 'Everything else on campus — modules, pins, your profile and settings.',
};

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
