import type { Metadata } from 'next';
import { DEMO_MARKETPLACE } from '@/lib/demo/dataset';
import { taka } from '@/lib/format';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Real listings have UUID ids; only a demo build has static listing metadata.
  const item = isBackendConfigured() ? null : DEMO_MARKETPLACE.find((m) => m.id === id);
  return {
    title: item ? `${item.title} · ${taka(item.price)}` : 'Marketplace Listing',
    description: item ? `${item.title} — ${item.description}` : 'A NUBCONNECT marketplace listing.',
  };
}

export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  return DEMO_MARKETPLACE.map((m) => ({ id: m.id }));
}

export default function MarketplaceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
