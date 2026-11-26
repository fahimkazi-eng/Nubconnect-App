import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Department',
  description: 'Department communities across Northern University Bangladesh — students, clubs and discussions first.',
};

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
