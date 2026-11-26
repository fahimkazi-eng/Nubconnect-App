import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Theme, privacy controls, notification preferences and My Pins.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
