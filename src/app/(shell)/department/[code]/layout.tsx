import type { Metadata } from 'next';
import { DEMO_DEPARTMENTS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  // A connected campus has departments in the database, so demo metadata is
  // never used as a stand-in for a real department's name.
  const dept = isBackendConfigured()
    ? null
    : DEMO_DEPARTMENTS.find((d) => d.code.toLowerCase() === code.toLowerCase());
  return {
    title: dept ? `${dept.code} — ${dept.name}` : 'Department',
    description: dept
      ? `${dept.name} at Northern University Bangladesh — the ${dept.code} student community, clubs and discussions.`
      : 'A NUB department community.',
  };
}

export function generateStaticParams() {
  // Demo department codes are not prerendered in a connected deployment.
  if (isBackendConfigured()) return [];
  return DEMO_DEPARTMENTS.map((d) => ({ code: d.code.toLowerCase() }));
}

export default function DepartmentDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
