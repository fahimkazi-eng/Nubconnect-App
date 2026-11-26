import type { Metadata } from 'next';

// Conversation titles live in per-user client state, so the route gets a
// generic server-rendered title; the client swaps in the chatter's name.
export const metadata: Metadata = {
  title: 'Chat',
  description: 'A NUBCONNECT conversation.',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
