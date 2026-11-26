import type { Metadata } from 'next';
import { Suspense } from 'react';
import MarketplaceBrowse from '@/components/marketplace/Browse';
import FeatureGate from '@/components/shell/FeatureGate';
import { PostSkeleton } from '@/components/ui/kit';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Buy and sell within the NUB student community.',
};

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      }
    >
      <FeatureGate
        flag="marketplace"
        title="Marketplace is closed right now"
        body="Buying and selling is paused while the university reviews the marketplace."
      >
        <MarketplaceBrowse />
      </FeatureGate>
    </Suspense>
  );
}
