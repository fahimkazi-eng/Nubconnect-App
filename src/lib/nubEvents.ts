// ============================================================================
// NUBCONNECT — Real campus events from nub.ac.bd (§16: authentic assets).
//
// REAL_EVENTS preserves the official NUB events feed as published on
// https://nub.ac.bd/nub/events — titles verbatim, each entry linking to its
// original article. None of this is fabricated.
//
// Honest sourcing notes:
//   • The feed lists dates as "Mon DD" (e.g. "Jul 29"). The year 2026 is
//     inferred from titles in the same listing ("…World Intellectual Property
//     Day 2026", "…Cricket Tournament 2026…"); the ISO `date` below records
//     that inference explicitly.
//   • The listing does not publish venues or start times, so venue/startTime
//     are intentionally absent — the UI shows what the source actually says.
//   • Organizer for every entry is NUB's official site feed
//     ("Northern University Bangladesh").
//   • These are PAST events (Feb–Jul 2026); they appear under an
//     "Official — from nub.ac.bd" section on the Events page. Upcoming demo
//     entries remain clearly labelled DEMO.
// ============================================================================
import type { CampusEvent } from './types';

const FEED = 'https://nub.ac.bd/nub/events';
const ORGANIZER = 'Northern University Bangladesh';
const ORIGIN = 'nub.ac.bd — Official';

export const REAL_EVENTS: CampusEvent[] = [
  {
    id: 'real-ev-1',
    title: 'IQAC, NUB Organizes Seminar on Building a Globally Leading University',
    organizer: ORGANIZER,
    date: '2026-07-29',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/4y37ta6x/iqac-nub-organizes-seminar-on-building-a-globally-leading-university',
  },
  {
    id: 'real-ev-2',
    title: 'International Innovation Competition and Exhibition Held at Northern University',
    organizer: ORGANIZER,
    date: '2026-05-09',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/kDcxb9Pg/international-innovation-competition-and-exhibition-held-at-northern-university',
  },
  {
    id: 'real-ev-3',
    title: 'NUB Hosts Inter-University Friendly Debate Competition',
    organizer: ORGANIZER,
    date: '2026-04-29',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/5wtdmque/nub-hosts-inter-university-friendly-debate-competition',
  },
  {
    id: 'real-ev-4',
    title: 'NUB Film and Photography Club Hosts “Freshers’ Reception 1.0: Lens Mate Meets',
    organizer: ORGANIZER,
    date: '2026-04-26',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/83fzxnau/nub-film-and-photography-club-hosts-%E2%80%9Cfreshers%E2%80%99-reception-1.0-lens-mate-meets',
  },
  {
    id: 'real-ev-5',
    title: 'Discussion Held at NUB on the Occasion of World Intellectual Property Day 2026',
    organizer: ORGANIZER,
    date: '2026-04-26',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/ydw0bl1h/discussion-held-at-nub-on-the-occasion-of-world-intellectual-property-day-2026',
  },
  {
    id: 'real-ev-6',
    title: 'Official Launch of the Debate and Public Speaking Club at NUB',
    organizer: ORGANIZER,
    date: '2026-04-26',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/o3lcjh2g/official-launch-of-the-debate-and-public-speaking-club-at-nub',
  },
  {
    id: 'real-ev-7',
    title: 'NUB CSE Six-a-Side Cricket Tournament 2026 Kicks Off with Festive Trophy Unveiling',
    organizer: ORGANIZER,
    date: '2026-04-22',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/7xpgpnvf/nub-cse-six-a-side-cricket-tournament-2026-kicks-off-with-festive-trophy-unveiling',
  },
  {
    id: 'real-ev-8',
    title: 'Northern University Bangladesh Celebrates Pohela Boishakh with Vibrant Cultural Festivities',
    organizer: ORGANIZER,
    date: '2026-04-18',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/cmzjyhhi/northern-university-bangladesh-celebrates-pohela-boishakh-with-vibrant-cultural-festivities',
  },
  {
    id: 'real-ev-9',
    title: 'Northern University holds discussion on Independence Day',
    organizer: ORGANIZER,
    date: '2026-03-28',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/kh5zbd3w/northern-university-holds-discussion-on-independence-day',
  },
  {
    id: 'real-ev-10',
    title: 'NUB Organizes Industrial Visit for Textile Department to Enhance Practical Knowledge and Industry Exposure',
    organizer: ORGANIZER,
    date: '2026-02-23',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/2vdmcfyy/nub-organizes-industrial-visit-for-textile-department-to-enhance-practical-knowledge-and-industry-exposure',
  },
  {
    id: 'real-ev-11',
    title: 'NUB Launches Tree Plantation Drive to Strengthen Environmental Sustainability',
    organizer: ORGANIZER,
    date: '2026-02-22',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/dxixuooj/nub-launches-tree-plantation-drive-to-strengthen-environmental-sustainability',
  },
  {
    id: 'real-ev-12',
    title: 'Northern University Bangladesh Observes International Mother Language Day with Profound Respect',
    organizer: ORGANIZER,
    date: '2026-02-21',
    originLabel: ORIGIN,
    registered: false,
    isDemo: false,
    sourceUrl: 'https://nub.ac.bd/nub/event/eyctmduq/northern-university-bangladesh-observes-international-mother-language-day-with-profound-respect',
  },
];

/** The official feed page, for "view source" affordances. */
export const NUB_EVENTS_FEED_URL = FEED;
