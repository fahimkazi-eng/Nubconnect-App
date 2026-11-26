import type { Metadata } from 'next';
import WhosOnCampus from '@/components/campus/WhosOnCampus';
import CampusMoments from '@/components/campus/CampusMoments';
import { HomeDesk, HomeEventsRail } from '@/components/campus/HomeRail';
import Highlights from '@/components/feed/Highlights';
import PeopleYouMayKnow from '@/components/feed/PeopleYouMayKnow';
import Composer from '@/components/feed/Composer';
import Feed from '@/components/feed/Feed';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Your NUBCONNECT campus social feed — highlights, people, circles and posts.',
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <WhosOnCampus />

      {/*
        Editorial hybrid composition:
        • < 2xl — a single, intentional reading column.
        • 2xl+  — personal desk | feed | campus context.
        The main social feed stays the centre of gravity on every size.
      */}
      <div className="2xl:grid 2xl:grid-cols-[210px_minmax(0,1fr)_280px] 2xl:items-start 2xl:gap-6">
        <div className="hidden 2xl:sticky 2xl:top-6 2xl:block">
          <HomeDesk />
        </div>

        <div className="min-w-0 space-y-5">
          <Composer />
          <Feed />
        </div>

        <div className="min-w-0 space-y-5">
          <PeopleYouMayKnow />
          <CampusMoments />
          <Highlights />
          <HomeEventsRail />
        </div>
      </div>
    </div>
  );
}
