import type { Metadata } from 'next';
import { DEMO_CLUBS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Real clubs are loaded from the database; only a demo build has static
  // club metadata keyed by demo slugs.
  const club = isBackendConfigured() ? null : DEMO_CLUBS.find((c) => c.slug === slug);
  return {
    title: club ? club.name : 'Club',
    description: club?.about ?? 'A NUB student club.',
  };
}

export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  return DEMO_CLUBS.map((c) => ({ slug: c.slug }));
}

export default function ClubDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
