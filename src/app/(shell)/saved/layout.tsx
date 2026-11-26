import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved',
  description: 'Posts, rooms and marketplace items you kept — privately, on this device.',
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
