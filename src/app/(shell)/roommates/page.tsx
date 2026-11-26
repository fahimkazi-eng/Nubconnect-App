import type { Metadata } from 'next';
import { Suspense } from 'react';
import BrowseRooms from '@/components/rooms/BrowseRooms';
import FeatureGate from '@/components/shell/FeatureGate';
import { PostSkeleton } from '@/components/ui/kit';

export const metadata: Metadata = {
  title: 'Find Roommates',
  description: 'Browse rooms, find roommates and manage your listings around NUB.',
};

export default function RoommatesPage() {
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
        flag="roommates"
        title="Roommate listings are paused"
        body="Housing listings are temporarily unavailable while the university reviews them."
      >
        <BrowseRooms />
      </FeatureGate>
    </Suspense>
  );
}
