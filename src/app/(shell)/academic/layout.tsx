import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Academic',
  description: 'NUB 4.00-scale GPA & CGPA calculators, the Bi/Tri-semester calendar, study groups and resources.',
};

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
