import type { Metadata } from 'next';
import { DEMO_PEOPLE, DEMO_USER } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  // Demo identities are never reachable on a connected campus, so their names
  // must not appear in that build's metadata either.
  const person = isBackendConfigured()
    ? null
    : (DEMO_PEOPLE.find((p) => p.username === username) ??
      (DEMO_USER.username === username ? { name: DEMO_USER.name, intro: DEMO_USER.intro } : undefined));
  return {
    title: person ? person.name : 'Profile',
    description: person?.intro ?? 'A NUBCONNECT student profile.',
  };
}

export function generateStaticParams() {
  if (isBackendConfigured()) return [];
  const usernames = [...DEMO_PEOPLE.map((p) => p.username), DEMO_USER.username];
  return usernames.map((username) => ({ username }));
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
