import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search NUBCONNECT — people, posts, circles, clubs, groups, rooms, marketplace and events.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
