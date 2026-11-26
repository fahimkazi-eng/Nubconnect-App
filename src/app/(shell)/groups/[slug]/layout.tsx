import type { Metadata } from 'next';
import { DEMO_GROUPS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Real groups are UUIDs loaded from the database; only a demo build has
  // static group metadata.
  const group = isBackendConfigured() ? null : DEMO_GROUPS.find((g) => g.slug === slug);
  return {
    title: group ? group.name : 'Group',
    description: group?.description ?? 'A NUBCONNECT study or project group.',
  };
}

export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  return DEMO_GROUPS.map((g) => ({ slug: g.slug }));
}

export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
