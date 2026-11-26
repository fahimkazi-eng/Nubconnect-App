import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opportunities',
  description: 'Leadership roles, on-campus jobs, competitions and volunteering for NUB students.',
};

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
