import type { Metadata } from 'next';
import { DEMO_CIRCLES } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Real circles are identified by UUID and their names come from the
  // database; only an unconfigured demo build has static circle metadata.
  const circle = isBackendConfigured() ? null : DEMO_CIRCLES.find((c) => c.slug === slug);
  if (!circle) return { title: 'Circle', description: 'A NUBCONNECT interest circle.' };
  return { title: circle.name, description: circle.description };
}

export function generateStaticParams() {
  // Do not prerender demo slugs in a connected deployment; those URLs are not
  // real circles and would 404 at runtime anyway.
  if (isBackendConfigured()) return [];
  return DEMO_CIRCLES.map((c) => ({ slug: c.slug }));
}

export default function CircleDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
