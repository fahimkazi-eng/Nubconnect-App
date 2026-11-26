import type { Metadata } from 'next';
import { Suspense } from 'react';
import CircleExplorer from '@/components/circle/CircleExplorer';
import { PostSkeleton } from '@/components/ui/kit';

export const metadata: Metadata = {
  title: 'Find Your Circle',
  description: 'Discover people, circles, clubs and groups around NUB.',
};

export default function CirclePage() {
  return (
    <Suspense fallback={<div className="space-y-3"><PostSkeleton /><PostSkeleton /></div>}>
      <CircleExplorer />
    </Suspense>
  );
}
