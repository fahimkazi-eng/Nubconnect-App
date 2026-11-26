import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import {
  Hind_Siliguri,
  Inter,
  Instrument_Serif,
  JetBrains_Mono,
  Manrope,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/** Editorial Campus — Manrope carries prominent headings. */
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

/** Editorial highlights only — never body or interface copy. */
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-editorial',
  display: 'swap',
});

/** Bengali copy — requested for the NUB community. */
const hind = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NUBCONNECT — Meet people. Find your circle. Live your campus.',
    template: '%s · NUBCONNECT',
  },
  description:
    'NUBCONNECT — the social campus of Northern University Bangladesh. Follow people, join circles and clubs, message classmates, find rooms and roommates, and trade on the student marketplace.',
  applicationName: 'NUBCONNECT',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'NUBCONNECT',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F3EB' },
    { media: '(prefers-color-scheme: dark)', color: '#171E29' },
  ],
};

// Applies the saved theme before first paint so the page never flashes.
// Runs before hydration, directly in <head>, without a custom <head> element
// (which would hoist streaming metadata out of the initial HTML).
// `theme-boot` suppresses transitions for 100ms while the dark palette
// applies, so colors resolve instantly instead of transitioning from the
// light palette — a transition that freezes at its start value in hidden
// (background) tabs and leaves stale computed colors for assistive tooling.
const themePrePaint = `(function(){try{var s=localStorage.getItem('nub-theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(s?JSON.parse(s)==='dark':d){var el=document.documentElement;el.classList.add('theme-boot');el.classList.add('dark');setTimeout(function(){el.classList.remove('theme-boot')},100)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable} ${manrope.variable} ${instrument.variable} ${hind.variable} font-sans`}
      >
        <Script id="theme-pre-paint" strategy="beforeInteractive">
          {themePrePaint}
        </Script>
        <AppProvider>{children}</AppProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
