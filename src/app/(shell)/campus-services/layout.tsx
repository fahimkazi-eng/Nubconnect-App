import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campus Services',
  description: 'Library, IT help desk, medical room, transport, accounts and exam controller — hours and where to ask.',
};

export default function CampusServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
