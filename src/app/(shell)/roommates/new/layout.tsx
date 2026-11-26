import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Room Listing',
  description: 'Post a room or seat for rent — general area only, photo-first, enquiries stay private.',
};

export default function NewRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
