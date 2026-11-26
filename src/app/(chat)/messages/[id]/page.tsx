import type { Metadata } from 'next';
import ChatView from '@/components/chat/ChatView';
import { DEMO_CONVERSATIONS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

// Server wrapper: keeps this route's metadata in the statically rendered
// head (a root-level 'use client' page streams its head tags into <body>).
export const metadata: Metadata = {
  title: 'Chat',
  description: 'A NUBCONNECT conversation.',
};

// Demo conversations are known at build time only in an unconfigured build.
// Real conversations render on demand via dynamicParams.
export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  return DEMO_CONVERSATIONS.map((c) => ({ id: c.id }));
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatView id={id} />;
}
