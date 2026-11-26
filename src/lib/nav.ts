// ============================================================================
// NUBCONNECT — Navigation model (CAMPUS ORBIT edition).
//
// Final product decision: exactly six primary destinations —
//   HOME · CIRCLE · CHATS · ROOM · MARKETPLACE · MORE
// Every destination is directly reachable from the mobile dock and the
// desktop sidebar. Academic and Department live inside More (§4).
//
// My Pins personalize secondary shortcuts. Pinning never removes a primary
// destination (§4.4).
// ============================================================================
import type { PinKey } from './types';

export const PRIMARY_DESTINATIONS = [
  { key: 'home', label: 'Home', short: 'Home', href: '/home', ariaLabel: 'Home dashboard' },
  { key: 'circle', label: 'Circle', short: 'Circle', href: '/circle', ariaLabel: 'Circle communities' },
  { key: 'messages', label: 'Chats', short: 'Chats', href: '/messages', ariaLabel: 'Chats and messages' },
  { key: 'roommates', label: 'Room', short: 'Room', href: '/roommates', ariaLabel: 'Room and roommates' },
  { key: 'marketplace', label: 'Marketplace', short: 'Market', href: '/marketplace', ariaLabel: 'Marketplace listings' },
  { key: 'more', label: 'More', short: 'More', href: '/more', ariaLabel: 'More destinations' },
] as const;

export interface PinDef {
  key: PinKey;
  label: string;
  icon: string;
  href: string;
  blurb: string;
}

export const PIN_CATALOG: PinDef[] = [
  { key: 'pulse', label: 'Campus Pulse', icon: 'pulse', href: '/pulse', blurb: "Who's around campus right now and what people are planning" },
  { key: 'department', label: 'Department', icon: 'graduation', href: '/department', blurb: 'Your department community, faculty and programs' },
  { key: 'academic', label: 'Academic', icon: 'book', href: '/academic', blurb: 'Planner, courses, calendar and GPA tools' },
  { key: 'events', label: 'Events', icon: 'calendar', href: '/events', blurb: 'University, club and student events' },
  { key: 'opportunities', label: 'Opportunities', icon: 'sparkles', href: '/opportunities', blurb: 'Scholarships, jobs, internships, competitions' },
  { key: 'lost-found', label: 'Lost & Found', icon: 'search', href: '/lost-found', blurb: 'Campus lost-and-found board' },
  { key: 'campus-services', label: 'Campus Services', icon: 'building', href: '/campus-services', blurb: 'Library, help desks and offices' },
  { key: 'saved', label: 'Saved', icon: 'bookmark', href: '/saved', blurb: 'Everything you saved across campus' },
  { key: 'passport', label: 'Campus Passport', icon: 'passport', href: '/passport', blurb: 'Your badges, stamps and membership cards' },
  { key: 'honours', label: 'Campus Honours', icon: 'medal', href: '/honours', blurb: 'Recognition for real contributions — transparent and opt-out' },
  { key: 'notifications', label: 'Notifications', icon: 'bell', href: '/notifications', blurb: 'Your campus activity feed' },
  { key: 'settings', label: 'Settings', icon: 'settings', href: '/settings', blurb: 'Pins, privacy and preferences' },
  { key: 'search', label: 'Search Campus', icon: 'search', href: '/search', blurb: 'Find people, clubs, rooms and items' },
];

export function pinDef(key: PinKey): PinDef {
  return PIN_CATALOG.find((p) => p.key === key) ?? PIN_CATALOG[0]!;
}
