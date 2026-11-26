import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Club meetups, department programs and campus-wide moments.',
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
