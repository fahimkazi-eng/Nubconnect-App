import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Your NUBCONNECT inbox — direct chats, roommate enquiries and marketplace conversations.',
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
