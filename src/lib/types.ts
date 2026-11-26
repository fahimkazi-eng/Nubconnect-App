// ============================================================================
// NUBCONNECT — shared domain types (mirrors the Supabase schema contract)
// ============================================================================

export type Role =
  | 'verified_student'
  | 'registered_user'
  | 'club_representative'
  | 'university_admin';

export type VerificationStatus =
  | 'Officially Verified'
  | 'Department Verified'
  | 'Recognized Organization'
  | 'Awaiting Verification'
  | 'Student-Led';

export interface Person {
  id: string;
  name: string;
  username: string;
  departmentCode: string;
  departmentName: string;
  semester: string;
  intro: string;
  interests: string[];
  isVerified: boolean;
  discoverable: boolean;
  mutualCircles?: string[];
  isNewAround?: boolean;
}

/**
 * The signed-in student. Demo mode maps DEMO_USER into this shape; a connected
 * backend maps the authenticated profile row into the same shape so every
 * surface reads one honest identity.
 */
export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: 'verified_student' | 'registered_user';
  departmentCode: string;
  departmentName: string;
  semester: string;
  allowMessages: 'Anyone' | 'University Students Only' | 'Consent Requests Only';
  discoverability: 'University Students Only' | 'Verified Students Only' | 'Public';
  isVerified: boolean;
  discoverable: boolean;
  intro: string;
  interests: string[];
  isNewAround: boolean;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  email?: string | null;
  /** The tenant this student belongs to — set when a backend is connected. */
  primaryUniversityId?: string | null;
  /** The student's department row, when they have one. */
  departmentId?: string | null;
  /** True only for the clearly-labelled DEMO_USER identity. */
  isDemo?: boolean;
}

/** Universal reaction vocabulary (§8) — original to NUBCONNECT, deliberately
 *  NOT a copy of any existing platform's reaction set. */
export type ReactionType =
  | 'love'
  | 'fire'
  | 'lol'
  | 'respect'
  | 'amazing'
  | 'support'
  | 'inspired'
  | 'proud';

export interface Comment {
  id: string;
  author: string;
  authorRole: string;
  text: string;
  createdAt: string; // ISO
  isMine?: boolean;
  /** Per-type reaction counts on this comment (§8: reactions on comments) */
  reactions?: Partial<Record<ReactionType, number>>;
  /** My reaction on this comment, if any */
  myReaction?: ReactionType | null;
}

/**
 * A Page that published a post — the official NUB Connect Page, a club page,
 * a department page. A Page is an organisational identity, so an official
 * announcement never appears to come from a random student profile.
 */
export interface PostPublisher {
  id: string;
  slug: string;
  name: string;
  kind: 'platform' | 'club' | 'department' | 'community';
  verificationStatus: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  originBadge: 'Official University Info' | 'Student Community Post' | 'Club Activity' | 'Campus Highlight';
  departmentCode?: string;
  circleSlug?: string;
  scope: 'University' | 'My Department' | 'My Circles';
  category: string;
  /** A headline, for posts that carry one (announcements, questions). */
  title?: string;
  createdAt: string; // ISO
  body: string;
  media: string[]; // photo URIs (photo-only release; no video)
  audience: 'University' | 'My Department' | 'My Circles';
  reactions: Partial<Record<ReactionType, number>>;
  myReaction?: ReactionType | null;
  /** My contextual response for this content kind (§8: Interested / Going /
   *  Celebrate / Collaborate / I can help / Appreciate / Follow / Join) */
  myContextAction?: boolean;
  saved: boolean;
  comments: Comment[];
  /** The Page this post was published by, when it was not a student post. */
  publisher?: PostPublisher | null;
  isDemo: boolean;
  sourceUrl?: string;
}

export interface CampusHighlight {
  id: string;
  title: string;
  subtitle: string;
  photo: string;
  origin: string;
  isDemo: boolean;
  /** Original source page when the photo comes from nub.ac.bd */
  sourceUrl?: string;
}

export interface Department {
  id?: string;
  code: string;
  name: string;
  faculty: string;
  semesterSystem: 'Tri-Semester (16 Weeks)' | 'Bi-Semester';
  verificationStatus: string;
  description: string;
  programs: string[];
  cohorts: string[];
  officialContact: string;
  sourceUrl: string;
  isDemo: boolean;
  /** Real department media (departments.logo_url / cover_url) — migration 020. */
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export interface Club {
  slug: string;
  name: string;
  category: string;
  scope: 'University-Wide' | 'Departmental' | 'Central';
  verificationStatus: VerificationStatus;
  about: string;
  memberCount: number;
  isDemo: boolean;
  // --- Club Universe depth (all optional: backward-compatible) ---
  /** Former names and abbreviations, preserved from roster reconciliation */
  aliases?: string[];
  /** Where this roster entry came from (Student Affairs list, club source…) */
  sourceNote?: string;
  /** The 7-level Campus Orbit taxonomy (richer than legacy statuses) */
  verification?: ClubVerification;
  /** Active clubs run programs; Inactive/Archived ones do not */
  activity?: 'Active' | 'Dormant';
  /** Current committee — ids reference demo people */
  committee?: ClubCommitteeMember[];
  /** Committee history for the Control Center timeline */
  committeeHistory?: ClubCommitteeMember[];
  achievements?: ClubAchievement[];
  /** Generated SVG scene photos of club activity */
  gallery?: string[];
  /** Person id of the acting president (demo Control Center access) */
  presidentId?: string;
  // --- Real backend identity (optional: demo clubs never set these) ---
  /** organizations.id — used for real membership/recognition RPCs */
  organizationId?: string;
  logoUrl?: string;
  coverUrl?: string;
  sourceUrl?: string;
  membershipOpen?: boolean;
  membershipRequirements?: string;
  /** True when the signed-in caller can manage this club (rep or university admin). */
  isManager?: boolean;
}

/** Club Universe verification taxonomy (§7). University-level verification is
 *  performed by the university ONLY — clubs can self-verify at most at
 *  'Club Verified'. */
export type ClubVerification =
  | 'Officially Verified'
  | 'Club Verified'
  | 'Department Recognized'
  | 'Student-Led'
  | 'Awaiting Verification'
  | 'Inactive'
  | 'Archived';

export interface ClubCommitteeMember {
  personId: string;
  name: string;
  role: string;
  since: string;
  note?: string;
}

export interface ClubAchievement {
  year: string;
  title: string;
  detail: string;
}

/** Digital membership card — QR token resolves on /verify/[token] */
export interface ClubMembershipCard {
  id: string;
  clubSlug: string;
  clubName: string;
  personName: string;
  personDepartment: string;
  role: string;
  since: string;
  verifyToken: string;
  isDemo: boolean;
}

export interface Circle {
  slug: string;
  name: string;
  category: string;
  description: string;
  memberCount: number;
  rules: string[];
  isDemo: boolean;
  /** Real circle media (community_groups.avatar_url / cover_url) — undefined until migration 020 is applied. */
  logoUrl?: string;
  coverUrl?: string;
  /** community_groups.created_by — used to authorize circle media changes. */
  createdBy?: string;
  // --- Temporary Circles (§6.4, optional for backward compatibility) ---
  /** Temporary circles fade out when they expire; permanent ones never do */
  temporary?: boolean;
  /** ISO instant when a temporary circle dissolves */
  expiresAt?: string;
  /** A temporary circle can graduate into a permanent interest circle */
  promotedFromTemporary?: boolean;
}

export interface Group {
  slug: string;
  name: string;
  type: 'Course' | 'Study' | 'Project' | 'Interest' | 'Event' | 'Department';
  description: string;
  memberCount: number;
  joined: boolean;
  isDemo: boolean;
}

/* --- CAMPUS ORBIT: Make a Plan (§6.1) -------------------------------------- */
export type PlanCategory = 'Study' | 'Sports' | 'Food' | 'Event' | 'Errand';

export interface ActivityPlan {
  id: string;
  title: string;
  category: PlanCategory;
  /** General campus meeting spot only — never a private address */
  spot: string;
  startsAt: string; // ISO
  durationMins: number;
  /** Real-life meetups are small on purpose: 2–20 participants */
  participantLimit: number;
  createdBy: string; // person id, or 'me'
  participants: string[]; // person ids
  note: string;
  createdAt: string; // ISO
  isDemo: boolean;
}

/* --- CAMPUS ORBIT: Campus Now (§6.2) --------------------------------------- */
/** Opt-in, auto-expiring presence. No location tracking — a student posts
 *  this themselves and it disappears on its own. */
export type CampusNowActivity = 'Studying' | 'Free' | 'Eating' | 'Walking' | 'Club room' | 'Gym';

export interface CampusNowStatus {
  id: string;
  personId: string;
  personName: string;
  activity: CampusNowActivity;
  /** General area only ("Library 3rd floor"), never an exact address */
  spot: string;
  note: string;
  /** Optional signal: happy to be approached / open to company right now */
  openToConnect?: boolean;
  postedAt: string; // ISO
  expiresAt: string; // ISO
  isDemo: boolean;
}

/* --- CAMPUS ORBIT: Campus Introductions (§6.3) ----------------------------- */
export interface Introduction {
  id: string;
  personId: string;
  reason: string;
  basis: 'Shared interest' | 'Mutual circle' | 'Same department';
  status: 'pending' | 'accepted' | 'declined';
  isDemo: boolean;
}

/* --- CAMPUS ORBIT: Campus Honours (§9) ------------------------------------- */
export type HonourCategory =
  | 'Mentoring'
  | 'Organizing'
  | 'Community Help'
  | 'Knowledge Sharing'
  | 'Creative Contribution'
  | 'Volunteering';

export interface CampusHonourEntry {
  id: string;
  personId: string;
  personName: string;
  departmentCode: string;
  category: HonourCategory;
  title: string;
  detail: string;
  /** Transparent contribution points — the only ranking input, ever */
  points: number;
  semester: string;
  isDemo: boolean;
}

export interface RoomPhoto {
  uri: string;
  room: 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Living Area';
  caption: string;
}

export type ListingStatus = 'Active' | 'Paused' | 'Reserved' | 'Sold' | 'Unavailable' | 'Archived';

export interface RoomListing {
  id: string;
  title: string;
  area: string; // general area only — never exact addresses
  rent: number; // ৳ / month
  advance: number;
  roomType: 'Single Room' | 'Shared Room' | '1-bed Flat' | '2-bed Flat' | 'Studio';
  furnished: 'Fully Furnished' | 'Semi-Furnished' | 'Unfurnished';
  shared: boolean;
  available: boolean;
  availableFrom: string;
  amenities: string[];
  utilities: string;
  houseRules: string;
  ownerName: string;
  ownerDepartment: string;
  photos: RoomPhoto[];
  saved: boolean;
  isDemo: boolean;
  // Social-experience additions (all optional for backward compatibility):
  ownerId?: string; // person id used for private enquiry conversations
  description?: string;
  seats?: number;
  views?: number;
  status?: ListingStatus;
  postedAgo?: string;
}

export interface RoommateProfile {
  id: string;
  name: string;
  departmentCode: string;
  intro: string;
  budgetMin: number;
  budgetMax: number;
  preferredArea: string;
  moveIn: string;
  lifestyle: string[];
  interests: string[];
  isDemo: boolean;
}

/** Hostel seat around campus (Room → Hostels tab). General area only —
 *  contact happens through private enquiries, never posted phone numbers. */
export interface HostelPhoto {
  uri: string;
  kind: 'Dorm Room' | 'Common Area' | 'Study Room' | 'Wash Area';
  caption: string;
}

export interface HostelListing {
  id: string;
  name: string;
  area: string; // general area only — never exact addresses
  monthlyRate: number; // ৳ / month per seat
  seatType: 'Single Seat' | 'Shared Room' | 'Twin Sharing';
  seatsAvailable: number;
  includes: string[]; // utilities/meals included in the rate
  messIncluded: boolean;
  rules: string; // curfew & guest policy summary
  gender: 'Male' | 'Female' | 'Separate floors';
  photos: HostelPhoto[];
  isDemo: boolean;
}

/** Student mess (dining subscription) around campus (Room → Mess tab). */
export interface MessPhoto {
  uri: string;
  kind: 'Dining Hall' | 'Kitchen' | 'Serving Counter';
  caption: string;
}

export interface MessListing {
  id: string;
  name: string;
  area: string;
  monthlyRate: number; // ৳ / month
  mealsPerDay: number;
  mealTimes: string;
  weeklyHighlight: string; // e.g. the one famous dinner
  vegOption: boolean;
  serves: string; // hostel / community it primarily serves
  photos: MessPhoto[];
  isDemo: boolean;
}

export type MarketplaceCategory =
  | 'Books & Academic'
  | 'Electronics'
  | 'Computers'
  | 'Furniture'
  | 'Clothing'
  | 'Accessories'
  | 'Bicycles & Transport'
  | 'Sports'
  | 'Home Items'
  | 'Services'
  | 'Other';

export interface MarketplaceListing {
  id: string;
  title: string;
  price: number; // ৳
  category: MarketplaceCategory;
  condition: 'New' | 'Like New' | 'Good' | 'Fair';
  description: string;
  pickupArea: string; // general area only
  sellerId: string;
  sellerName: string;
  sellerDepartment: string;
  status: ListingStatus;
  createdAt: string;
  photos: string[];
  saved: boolean;
  isDemo: boolean;
}

export interface Message {
  id: string;
  senderId: string; // 'me' for the current user in demo mode
  text: string;
  createdAt: string;
  photo?: string;
  /** True when the media path carries an audio clip instead of an image. */
  audio?: boolean;
  replyToId?: string;
  reactions?: string[]; // emoji applied by me
  read?: boolean;
  /** Set when the sender edited the message (requires migration 017). */
  editedAt?: string;
  /** Set when the sender soft-deleted the message (requires migration 017). */
  deletedAt?: string;
}

export interface Conversation {
  id: string;
  kind: 'direct' | 'group' | 'room' | 'marketplace' | 'plan';
  title: string;
  participants: string[]; // person ids
  avatarSeeds: string[]; // for group tiles
  unread: number;
  pinned: boolean;
  muted: boolean;
  request: 'none' | 'incoming' | 'sent' | 'declined';
  messages: Message[];
  context?: {
    // item-linked conversations (room / marketplace)
    thumb: string;
    title: string;
    price?: string;
    status?: string;
    href: string;
  };
  /** Set on Make-a-Plan group chats so a plan page can reopen its chat */
  planId?: string;
  /** Set on Campus Introduction chats */
  introductionId?: string;
  /** Real student behind a 1:1 conversation (absent for demo/group chats). */
  other?: {
    id: string;
    username: string;
    name: string;
    avatarUrl?: string | null;
    isVerified: boolean;
  };
  /** Group/plan chats stay in this browser session until group messaging ships. */
  isLocal?: boolean;
  /** False until the real message history has been fetched for this chat. */
  messagesLoaded?: boolean;
  /** Latest message for the inbox preview (real conversations). */
  lastMessage?: Message;
  /** Hidden from All/Unread/Groups by the owner; restorable from Archived. */
  archived?: boolean;
  isDemo: boolean;
}

export interface AppNotification {
  id: string;
  category: 'Social' | 'Messages' | 'Communities' | 'Marketplace' | 'Roommates' | 'Events' | 'Academic' | 'System';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href: string;
  isDemo: boolean;
}

export interface CampusEvent {
  id: string;
  title: string;
  organizer: string;
  /** Venue/time are unknown for real nub.ac.bd listings (optional since 005) */
  venue?: string;
  date: string;
  startTime?: string;
  originLabel: string;
  registered: boolean;
  isDemo: boolean;
  /** Original nub.ac.bd article for real events (title preserved verbatim) */
  sourceUrl?: string;
  /** Contextual response for events: Interested / Going (§8) */
  interest?: 'interested' | 'going' | null;
}

export interface Opportunity {
  id: string;
  title: string;
  category: string;
  description: string;
  isDemo: boolean;
}

export interface LostFoundItem {
  id: string;
  title: string;
  kind: 'Lost' | 'Found';
  location: string;
  date: string;
  description: string;
  isDemo: boolean;
}

export interface CampusService {
  id: string;
  name: string;
  description: string;
  location: string;
  hours: string;
  // desk / office reference only — never a fabricated phone number
  contactPoint: string;
  isDemo: boolean;
}

export type DestinationKey =
  | 'home'
  | 'circle'
  | 'messages'
  | 'roommates'
  | 'marketplace'
  | 'more';

export type PinKey =
  | 'pulse'
  | 'department'
  | 'academic'
  | 'events'
  | 'opportunities'
  | 'lost-found'
  | 'campus-services'
  | 'saved'
  | 'passport'
  | 'honours'
  | 'notifications'
  | 'settings'
  | 'search';

export interface Pin {
  key: PinKey;
  label: string;
  icon: string; // lucide icon name resolved in components
  href: string;
}
