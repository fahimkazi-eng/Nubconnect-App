import type { Metadata } from 'next';
import { DEMO_ROOMS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Real listings have UUID ids; only a demo build has static listing metadata.
  const room = isBackendConfigured() ? null : DEMO_ROOMS.find((r) => r.id === id);
  return {
    title: room ? room.title : 'Room Listing',
    description: room
      ? `${room.title} — ${room.area}. General area only; enquiries stay private on NUBCONNECT.`
      : 'A NUBCONNECT roommate listing.',
  };
}

export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  return DEMO_ROOMS.map((r) => ({ id: r.id }));
}

export default function RoomDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
