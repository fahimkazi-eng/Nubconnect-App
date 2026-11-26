'use client';

// ============================================================================
// NUBCONNECT — Client application store.
//
// Holds the interactive session state (follows, joins, saves, pins, posts,
// conversations, listings, notifications) and persists user preferences to
// localStorage. When a Supabase backend is configured these same actions are
// intended to hit the real tables (see src/lib/data.ts); in demo mode they
// mutate the clearly-labelled DEMO dataset in memory.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ActivityPlan,
  AppNotification,
  AppUser,
  CampusHonourEntry,
  Circle,
  Club,
  ClubMembershipCard,
  Conversation,
  Group,
  HonourCategory,
  Introduction,
  MarketplaceListing,
  Message,
  Person,
  PinKey,
  Post,
  ReactionType,
  RoomListing,
} from './types';
import {
  DEMO_CIRCLES,
  DEMO_CLUBS,
  DEMO_CONVERSATIONS,
  DEMO_GROUPS,
  DEMO_HONOURS,
  DEMO_INTRODUCTIONS,
  DEMO_JOINED_CLUBS,
  DEMO_MARKETPLACE,
  DEMO_MEMBERSHIP_CARDS,
  DEMO_NOTIFICATIONS,
  DEMO_PEOPLE,
  DEMO_PLANS,
  DEMO_POSTS,
  DEMO_ROOMS,
  DEMO_USER,
} from './demo/dataset';
import {
  applyToOrganization,
  awardClubHonour as awardClubHonourRpc,
  leaveOrganization,
  loadClubDirectory,
  loadHonours,
  loadMyClubState,
  requestClubVerification as requestClubVerificationRpc,
  reviewClubApplication as reviewClubApplicationRpc,
  setClubMemberRole as setClubMemberRoleRpc,
  withdrawClubApplication as withdrawClubApplicationRpc,
  type ClubMembership,
  type ManagedClub,
} from './clubs';
import { loadJoinedGroupIds, setCircleMembership } from './circles';
import { getSupabaseBrowserClient, isBackendConfigured } from './supabase';
import {
  applyPreferences,
  discoverabilityFromDb,
  mapProfileToAppUser,
  messagingFromDb,
  type ProfileRow,
} from './auth';
import {
  friendlyMessagingError,
  isAudioPath,
  isUuid,
  loadArchivedIds,
  loadBlockedIds,
  loadInbox,
  loadMessages,
  mapMessageRow,
  uploadMessagePhoto,
  type MessageRow,
} from './messaging';
import {
  editCommentBody,
  loadFeedPosts,
  loadFollowedProfileIds,
  publishComment,
  publishPost,
  removeComment,
  setCommentReaction,
  setFollow,
  setPostReaction,
  uploadPostPhoto,
} from './posts';
import {
  followPage,
  loadPageBySlug,
  unfollowPage,
} from './pages';
import { loadPeople } from './people';
import { loadCommunityGroups } from './data';
import {
  EMPTY_ADMIN_ACCESS,
  loadAdminAccess,
  type AdminAccess,
} from './admin';
import {
  DEFAULT_PLATFORM_FLAGS,
  loadPlatformFlags,
  type PlatformFlags,
} from './platform';
import {
  clearAvailability,
  createActivity as createPulseActivity,
  joinActivity as joinPulseActivity,
  leaveActivity as leavePulseActivity,
  loadActivities,
  loadAvailability,
  loadCampusAreas,
  publishAvailability,
  requestToJoin as requestToJoinActivity,
  respondToJoinRequest as respondToPulseJoinRequest,
  subscribeToPulse,
  type CampusArea,
  type CreateActivityInput,
  type PublishAvailabilityInput,
  type PulseActivity,
  type PulseAvailability,
} from './pulse';
import {
  loadNotifications,
  loadUserPreferences,
  markAllNotificationsRead as markAllNotificationsReadRows,
  markNotificationRead as markNotificationReadRow,
  notificationPreferencesFromDb,
  saveUserPreferences,
} from './notifications';
import { EMPTY_SAVED, loadSavedState, setSavedItem, type SavedState } from './saved';
import {
  createMarketplaceListing,
  createRoomListing,
  setMarketplaceListingStatus,
} from './listings';

/**
 * A neutral, non-personal identity used ONLY while a configured backend has
 * no authenticated account (initial session load, or a signed-out visitor).
 * It is deliberately not DEMO_USER: sample students must never look like the
 * viewer in a connected build. Writes are gated by `authUser` separately.
 */
const SIGNED_OUT_USER: AppUser = {
  id: '',
  name: 'Guest',
  username: '',
  role: 'registered_user',
  departmentCode: '',
  departmentName: '',
  semester: '',
  allowMessages: 'University Students Only',
  discoverability: 'University Students Only',
  isVerified: false,
  discoverable: false,
  intro: '',
  interests: [],
  isNewAround: false,
};

const LS = {
  theme: 'nub-theme',
  follows: 'nub-follows',
  joins: 'nub-joins',
  saved: 'nub-saved',
  pins: 'nub-pins',
  onboarded: 'nub-onboarded',
  searches: 'nub-recent-searches',
  privacy: 'nub-privacy',
  clubs: 'nub-joined-clubs',
  clubApplications: 'nub-club-applications',
  promotedCircles: 'nub-promoted-circles',
} as const;

export const DEFAULT_PINS: PinKey[] = [
  'department',
  'academic',
  'events',
  'opportunities',
  'lost-found',
  'saved',
];

export const ALL_PIN_KEYS: PinKey[] = [
  'department',
  'academic',
  'events',
  'opportunities',
  'lost-found',
  'campus-services',
  'saved',
  'passport',
  'notifications',
  'settings',
  'search',
];

export interface PrivacyPrefs {
  discoverability: 'University Students Only' | 'Verified Students Only' | 'Public';
  allowMessages: 'Anyone' | 'University Students Only' | 'Consent Requests Only';
  showSemester: boolean;
  notifyEvents: boolean;
  notifyClubUpdates: boolean;
  notifyRoommateInquiries: boolean;
  /** Campus Honours opt-out (§9): hide my name from all honours surfaces */
  showInHonours: boolean;
}

const DEFAULT_PRIVACY: PrivacyPrefs = {
  discoverability: 'University Students Only',
  allowMessages: 'Consent Requests Only',
  showSemester: true,
  notifyEvents: true,
  notifyClubUpdates: true,
  notifyRoommateInquiries: true,
  showInHonours: true,
};

export interface Toast {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'warning';
}

interface Store {
  ready: boolean;
  user: AppUser;
  privacy: PrivacyPrefs;
  setPrivacy: (p: Partial<PrivacyPrefs>) => Promise<boolean>;
  /** True while the account's saved preference row is being read. */
  preferencesLoading: boolean;
  /** True while a preference write to user_preferences is in flight. */
  preferencesSaving: boolean;
  /** Last save/load failure, in the student's own words. */
  preferencesError: string | null;
  retrySavePreferences: () => Promise<void>;

  // Accounts (Phase 2)
  authConfigured: boolean;
  authLoading: boolean;
  isDemoUser: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Admin command centre (PART 13/28). The UI only reflects the database:
  // every write still goes through an authorized RPC.
  adminAccess: AdminAccess;
  refreshAdminAccess: () => Promise<void>;
  platformFlags: PlatformFlags;
  refreshPlatformFlags: () => Promise<void>;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Social graph
  follows: string[];
  toggleFollow: (personId: string) => boolean;
  isFollowing: (personId: string) => boolean;

  joinedCircles: string[];
  joinedGroups: string[];
  toggleJoinCircle: (slug: string) => boolean;
  toggleJoinGroup: (slug: string) => boolean;
  /** Temporary circles a member voted to keep as permanent interest circles */
  promotedCircles: string[];
  promoteCircle: (slug: string) => boolean;

  // CAMPUS ORBIT — Make a Plan (§6.1)
  plans: ActivityPlan[];
  createPlan: (input: {
    title: string;
    category: ActivityPlan['category'];
    spot: string;
    startsAt: string;
    durationMins: number;
    participantLimit: number;
    note: string;
  }) => string;
  joinPlan: (id: string) => boolean;
  leavePlan: (id: string) => boolean;
  planConversationId: (planId: string) => string | null;

  // CAMPUS ORBIT — Campus Introductions (§6.3)
  introductions: Introduction[];
  respondIntroduction: (id: string, response: 'accepted' | 'declined') => void;

  // CAMPUS ORBIT — Club Universe (§7)
  clubs: Club[];
  clubsLoading: boolean;
  clubDirectoryError: string | null;
  joinedClubs: string[];
  clubApplications: string[];
  managedClubSlugs: string[];
  myClubMemberships: ClubMembership[];
  membershipCards: ClubMembershipCard[];
  honours: CampusHonourEntry[];
  honoursLoading: boolean;
  honoursError: string | null;
  refreshClubs: () => Promise<void>;
  refreshHonours: () => Promise<void>;

  // People & communities — the real directory, never sample students.
  people: Person[];
  peopleLoading: boolean;
  circles: Circle[];
  groups: Group[];
  refreshPeople: () => Promise<void>;
  refreshCommunities: () => Promise<void>;
  refreshNotifications: () => Promise<void>;

  // CAMPUS PULSE — who is around, and what is being planned
  availability: PulseAvailability[];
  activities: PulseActivity[];
  campusAreas: CampusArea[];
  pulseLoading: boolean;
  refreshPulse: () => Promise<void>;
  publishMyAvailability: (
    input: Omit<PublishAvailabilityInput, 'userId' | 'universityId'>,
  ) => Promise<{ ok: boolean; error?: string }>;
  clearMyAvailability: () => Promise<void>;
  createActivity: (
    input: Omit<CreateActivityInput, 'creatorId' | 'universityId'>,
  ) => Promise<{ ok: boolean; error?: string }>;
  joinActivity: (planId: string) => Promise<{ ok: boolean; error?: string }>;
  leaveActivity: (planId: string) => Promise<{ ok: boolean; error?: string }>;
  requestToJoin: (planId: string, note?: string) => Promise<{ ok: boolean; error?: string }>;
  respondToJoinRequest: (requestId: string, planId: string, accept: boolean) => Promise<void>;
  applyToClub: (slug: string, note?: string) => Promise<void>;
  withdrawClubApplication: (slug: string) => Promise<void>;
  leaveClub: (slug: string) => Promise<void>;
  reviewClubApplication: (
    membershipId: string,
    decision: 'approved' | 'rejected' | 'pending',
    role?: string,
    note?: string,
  ) => Promise<boolean>;
  setClubMemberRole: (membershipId: string, role: string) => Promise<boolean>;
  awardClubHonour: (input: {
    organizationId: string;
    personId: string;
    category: HonourCategory;
    title: string;
    detail?: string;
    points: number;
    semester: string;
  }) => Promise<boolean>;
  requestClubVerification: (slug: string, notes?: string) => Promise<boolean>;

  // Saves
  saved: SavedState;
  toggleSavePost: (id: string) => Promise<boolean>;
  toggleSaveRoom: (id: string) => Promise<boolean>;
  toggleSaveProduct: (id: string) => Promise<boolean>;

  // Pins
  pins: PinKey[];
  setPins: (pins: PinKey[]) => void;
  resetPins: () => void;

  // Feed
  posts: Post[];
  addPost: (p: {
    body: string;
    media: string[];
    /** The photographs to upload, when the post is published to the backend. */
    files?: File[];
    audience: Post['audience'];
    circleSlug?: string;
  }) => void;
  /** Re-read the real feed (no-op in demo mode). */
  refreshFeed: () => Promise<void>;
  react: (postId: string, reaction: ReactionType) => void;
  /** React to a comment (§8: reactions work on comments too) */
  reactToComment: (postId: string, commentId: string, reaction: ReactionType) => void;
  /** Toggle the single contextual action offered by this post (§8) */
  toggleContextAction: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  editComment: (postId: string, commentId: string, text: string) => void;
  deleteComment: (postId: string, commentId: string) => void;
  hiddenPostIds: string[];
  hidePost: (postId: string) => void;
  mutedAccountIds: string[];
  muteAccount: (authorId: string) => void;
  showLessLikeThis: (postId: string) => void;
  /**
   * File a report. When a machine-readable target is provided and the backend
   * is connected with a signed-in student, this inserts into `reports` (the
   * only client-write path; reads stay with moderators via SECURITY DEFINER
   * RPCs). Without a target it says honestly that nothing was submitted.
   */
  reportContent: (
    what: string,
    target?: { targetType: string; targetId: string; reason?: string },
  ) => void;

  // Messages
  conversations: Conversation[];
  inboxLoading: boolean;
  inboxError: string | null;
  /** Re-read the real inbox (no-op in demo mode). */
  refreshInbox: () => Promise<void>;
  /** Re-read one real conversation's history and metadata. */
  refreshConversation: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    text: string,
    photo?: string,
    photoFile?: File,
  ) => Promise<boolean>;
  reactToMessage: (conversationId: string, messageId: string, emoji: string) => Promise<void>;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  acceptRequest: (conversationId: string) => Promise<void>;
  declineRequest: (conversationId: string) => Promise<void>;
  startConversation: (opts: {
    personId: string;
    title: string;
    context?: Conversation['context'];
    kind?: Conversation['kind'];
    initialNote: string;
    introductionId?: string;
  }) => Promise<string>;
  unreadCount: number;
  markConversationRead: (conversationId: string) => Promise<void>;
  toggleConversationPin: (conversationId: string) => Promise<void>;
  toggleConversationMute: (conversationId: string) => Promise<void>;
  toggleConversationArchive: (conversationId: string) => Promise<void>;
  /** Pin or unpin a message in a conversation (migration 018 for persistence). */
  toggleMessagePin: (conversationId: string, messageId: string) => Promise<void>;
  /** conversationId → pinned message ids, oldest pin first. */
  pinnedMessages: Record<string, string[]>;
  /** Device-local "Appear offline" — never synced, by design. */
  presenceHidden: boolean;
  setPresenceHidden: (v: boolean) => void;
  editMessage: (conversationId: string, messageId: string, text: string) => Promise<boolean>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<boolean>;
  forwardMessage: (targetConversationId: string, text: string) => Promise<boolean>;
  /** Person ids the student has blocked — their conversations are hidden and they cannot start new ones. */
  blockedIds: string[];
  blockPerson: (personId: string, name: string) => Promise<void>;
  unblockPerson: (personId: string) => Promise<void>;

  // Listings
  myRooms: RoomListing[];
  addRoomListing: (
    r: Omit<RoomListing, 'id' | 'isDemo' | 'saved'>,
    files: readonly File[],
  ) => Promise<string | null>;
  updateRoomListing: (id: string, patch: Partial<RoomListing>) => void;
  myProducts: MarketplaceListing[];
  addProductListing: (
    p: Omit<MarketplaceListing, 'id' | 'isDemo' | 'saved'>,
    files: readonly File[],
  ) => Promise<string | null>;
  updateProductListing: (id: string, patch: Partial<MarketplaceListing>) => void;

  // Notifications — real rows written by the database for this account.
  notifications: AppNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;

  // Onboarding & misc
  onboarded: boolean;
  finishOnboarding: () => void;

  recentSearches: string[];
  pushRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;

  // Toasts
  toasts: Toast[];
  pushToast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp must be used inside <AppProvider>');
  return s;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    setValue(readJSON(key, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full or unavailable — keep in-memory state */
        }
        return next;
      });
    },
    [key],
  );
  return [value, set];
}

let toastSeq = 1;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = usePersisted<'light' | 'dark'>(LS.theme, 'light');
  const [privacyRaw, setPrivacyState] = usePersisted<PrivacyPrefs>(LS.privacy, DEFAULT_PRIVACY);
  // Sessions persisted before an option existed (e.g. showInHonours) must not
  // read as opted-out — normalize every read against the defaults.
  const privacy = useMemo<PrivacyPrefs>(() => ({ ...DEFAULT_PRIVACY, ...privacyRaw }), [privacyRaw]);
  // Preference reads/writes are account data. On this device the localStorage
  // copy is only a cache; the signed-in user's row is the source of truth.
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const preferenceWriteSeq = useRef(0);
  const [localFollows, setLocalFollows] = usePersisted<string[]>(LS.follows, ['p-rakib', 'p-farhana']);
  /** Who the signed-in student follows, read from the backend. */
  const [realFollows, setRealFollows] = useState<string[]>([]);
  const [joins, setJoins] = usePersisted<string[]>(
    LS.joins,
    ['photography', 'technology', 'grp-dbms', 'grp-hinari', 'grp-cse-2022'],
  );
  const [saved, setSaved] = usePersisted<SavedState>(LS.saved, {
    posts: ['post-1', 'post-2', 'post-5', 'post-9'],
    rooms: ['rm-2'],
    products: ['mk-1', 'mk-6'],
  });
  const [pins, setPinsState] = usePersisted<PinKey[]>(LS.pins, DEFAULT_PINS);
  // Older sessions may persist a key that has since been promoted to a
  // primary destination (e.g. 'marketplace') — filter to the live catalog.
  const validPins = useMemo(() => pins.filter((p) => ALL_PIN_KEYS.includes(p)), [pins]);
  const [onboarded, setOnboarded] = usePersisted<boolean>(LS.onboarded, false);
  const [recentSearches, setRecentSearches] = usePersisted<string[]>(LS.searches, []);

  // CAMPUS ORBIT state
  // Demo mode persists memberships on this device. With a real account the
  // database is the source of truth (see the Phase 4 club effect below).
  const [localJoinedClubs, setLocalJoinedClubs] = usePersisted<string[]>(
    LS.clubs,
    DEMO_JOINED_CLUBS,
  );
  const [localClubApplications, setLocalClubApplications] = usePersisted<string[]>(
    LS.clubApplications,
    [],
  );
  const [promotedCircles, setPromotedCircles] = usePersisted<string[]>(LS.promotedCircles, []);

  // The DEMO dataset is a development fixture. With a backend connected the
  // application starts empty and fills from the database, so production never
  // shows sample students, posts or conversations as campus activity.
  const backendConfigured = isBackendConfigured();

  const [posts, setPosts] = useState<Post[]>(() => (backendConfigured ? [] : DEMO_POSTS));
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [mutedAccountIds, setMutedAccountIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    backendConfigured ? [] : DEMO_CONVERSATIONS,
  );
  const [inboxLoading, setInboxLoading] = useState(backendConfigured);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [plans, setPlans] = useState<ActivityPlan[]>(() => (backendConfigured ? [] : DEMO_PLANS));
  const [introductions, setIntroductions] = useState<Introduction[]>(() =>
    backendConfigured ? [] : DEMO_INTRODUCTIONS,
  );
  const [clubs, setClubs] = useState<Club[]>(() => (backendConfigured ? [] : DEMO_CLUBS));
  const [clubsLoading, setClubsLoading] = useState(backendConfigured);
  const [clubDirectoryError, setClubDirectoryError] = useState<string | null>(null);
  const [realMemberships, setRealMemberships] = useState<ClubMembership[]>([]);
  const [managedClubs, setManagedClubs] = useState<ManagedClub[]>([]);
  const [realJoinedGroupIds, setRealJoinedGroupIds] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Record<string, string[]>>({});
  // Device-local "Appear offline" — deliberately not synced: leaving presence
  // on or off everywhere is a separate, explicit product decision.
  const [presenceHidden, setPresenceHiddenState] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('nub-appear-offline') === '1';
    } catch {
      return false;
    }
  });
  const setPresenceHidden = useCallback((v: boolean) => {
    setPresenceHiddenState(v);
    try {
      window.localStorage.setItem('nub-appear-offline', v ? '1' : '0');
    } catch {
      // Quota/private-mode storage failure: presence stays as-is, which is safe.
    }
  }, []);
  const [honours, setHonours] = useState<CampusHonourEntry[]>(() =>
    backendConfigured ? [] : DEMO_HONOURS,
  );
  const [honoursLoading, setHonoursLoading] = useState(backendConfigured);
  const [honoursError, setHonoursError] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<RoomListing[]>([]);
  const [myProducts, setMyProducts] = useState<MarketplaceListing[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    backendConfigured ? [] : DEMO_NOTIFICATIONS,
  );
  const [notificationsLoading, setNotificationsLoading] = useState(backendConfigured);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(backendConfigured);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [availability, setAvailability] = useState<PulseAvailability[]>([]);
  const [activities, setActivities] = useState<PulseActivity[]>([]);
  const [campusAreas, setCampusAreas] = useState<CampusArea[]>([]);
  const [pulseLoading, setPulseLoading] = useState(backendConfigured);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Guards async inbox/history responses so a signed-out or switched account
  // can never repopulate the next student's screen with stale rows.
  const authUserIdRef = useRef<string | null>(null);

  // --- Accounts (Phase 2) ---------------------------------------------------
  // With a backend configured the real auth session is the source of truth;
  // until it resolves the viewer is a neutral Guest, never a demo student.
  // Without a backend we keep the clearly-labelled DEMO_USER identity — never
  // a simulated login presented as real.
  const authConfigured = isBackendConfigured();
  const [authLoading, setAuthLoading] = useState(authConfigured);
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess>(EMPTY_ADMIN_ACCESS);
  const [platformFlags, setPlatformFlags] = useState<PlatformFlags>(DEFAULT_PLATFORM_FLAGS);

  const hydrateProfile = useCallback(
    async (id: string, email?: string | null) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      setPreferencesLoading(true);
      setPreferencesError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, username, display_name, avatar_url, cover_url, primary_university_id, department_id, semester_label, bio, interests, is_verified_student, is_suspended, departments:department_id(code,name)',
        )
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const profile = data as unknown as ProfileRow;
        const { row: prefs, error: prefsError } = await loadUserPreferences(supabase, id);

        setAuthUser(applyPreferences(mapProfileToAppUser(profile, email), prefs));

        if (prefsError) {
          // Keep the defaults visible, but say plainly that saved choices
          // could not be read instead of implying they were loaded.
          setPreferencesError(prefsError);
        } else if (prefs) {
          const mapped = notificationPreferencesFromDb(prefs, DEFAULT_PRIVACY);
          setPrivacyState((prev) => ({
            ...prev,
            discoverability: discoverabilityFromDb(prefs.profile_visibility),
            allowMessages: messagingFromDb(prefs.allow_direct_messages),
            showSemester: prefs.show_semester ?? prev.showSemester,
            notifyEvents: mapped.notifyEvents,
            notifyClubUpdates: mapped.notifyClubUpdates,
            notifyRoommateInquiries: mapped.notifyRoommateInquiries,
            showInHonours: prefs.show_in_honours ?? prev.showInHonours,
          }));
        }
        setPreferencesLoading(false);
        return;
      }

      // Older projects may not have migration 006 applied yet. Use only what
      // auth itself holds — never fabricate profile details.
      const { data: authData } = await supabase.auth.getUser();
      const meta = (authData.user?.user_metadata ?? {}) as Record<string, string | undefined>;
      setAuthUser({
        id,
        name: meta.display_name ?? meta.full_name ?? email?.split('@')[0] ?? 'Student',
        username: meta.username ?? email?.split('@')[0] ?? 'student',
        role: 'registered_user',
        departmentCode: 'NUB',
        departmentName: 'Northern University Bangladesh',
        semester: 'Semester not set',
        allowMessages: 'Consent Requests Only',
        discoverability: 'University Students Only',
        isVerified: false,
        discoverable: true,
        intro: '',
        interests: [],
        isNewAround: false,
        email: email ?? null,
        isDemo: false,
      });
      // No profile row means no preference row can be trusted yet.
      setPreferencesLoading(false);
    },
    [setPrivacyState],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session?.user) {
          await hydrateProfile(data.session.user.id, data.session.user.email);
        }
      } catch (error) {
        // Never strand the app on "Checking your account…" forever — a failed
        // session probe must fall back to the safe unauthenticated state.
        console.error('NUBCONNECT auth bootstrap failed:', error);
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) void hydrateProfile(session.user.id, session.user.email);
      else setAuthUser(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const user: AppUser = authUser ?? (authConfigured ? SIGNED_OUT_USER : DEMO_USER);

  /**
   * Admin access is a database answer, not a client assumption. Refresh it
   * whenever the signed-in identity changes so a revoked role disappears.
   */
  const refreshAdminAccess = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      setAdminAccess(EMPTY_ADMIN_ACCESS);
      return;
    }
    setAdminAccess(await loadAdminAccess(supabase));
  }, [authUser]);

  const refreshPlatformFlags = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPlatformFlags(DEFAULT_PLATFORM_FLAGS);
      return;
    }
    setPlatformFlags(await loadPlatformFlags(supabase));
  }, []);

  useEffect(() => {
    void refreshAdminAccess();
  }, [refreshAdminAccess]);

  // Platform switches are public (they only say whether a surface is open),
  // so this loads even before sign-in.
  useEffect(() => {
    void refreshPlatformFlags();
  }, [refreshPlatformFlags]);

  // Real club state only replaces demo state once a student is signed in.
  // Backend configured + signed out stays an honest demo browser.
  const backendSignedIn = isBackendConfigured() && Boolean(authUser);

  // Follows live in the database when a student is signed in; the persisted
  // list is the demo-mode fallback.
  const follows = backendSignedIn ? realFollows : localFollows;

  const joinedClubs = useMemo(
    () =>
      backendSignedIn
        ? realMemberships.filter((m) => m.status === 'approved').map((m) => m.slug)
        : localJoinedClubs,
    [backendSignedIn, realMemberships, localJoinedClubs],
  );

  // Circle and group membership comes from `group_members` once a student is
  // signed in. The persisted local list is only the unconfigured demo browser.
  const joinedCircles = useMemo(
    () =>
      backendSignedIn
        ? realJoinedGroupIds.filter((id) => circles.some((c) => c.slug === id))
        : joins.filter((id) => !id.startsWith('grp-')),
    [backendSignedIn, realJoinedGroupIds, circles, joins],
  );

  const joinedGroups = useMemo(
    () =>
      backendSignedIn
        ? realJoinedGroupIds.filter((id) => groups.some((g) => g.slug === id))
        : joins.filter((id) => id.startsWith('grp-')),
    [backendSignedIn, realJoinedGroupIds, groups, joins],
  );

  const clubApplications = useMemo(
    () =>
      backendSignedIn
        ? realMemberships.filter((m) => m.status === 'pending').map((m) => m.slug)
        : localClubApplications,
    [backendSignedIn, realMemberships, localClubApplications],
  );

  const managedClubSlugs = useMemo(
    () =>
      backendSignedIn
        ? managedClubs.map((m) => m.slug)
        : DEMO_CLUBS.filter((c) => c.presidentId === DEMO_USER.id).map((c) => c.slug),
    [backendSignedIn, managedClubs],
  );

  const membershipCards = useMemo<ClubMembershipCard[]>(() => {
    if (!backendSignedIn) {
      return DEMO_MEMBERSHIP_CARDS.filter((c) => localJoinedClubs.includes(c.clubSlug));
    }
    return realMemberships
      .filter((m) => m.status === 'approved')
      .map((m) => ({
        id: m.organizationId,
        clubSlug: m.slug,
        clubName: m.name,
        personName: user.name,
        personDepartment: `${user.departmentCode} • ${user.semester}`,
        role: m.role || 'Member',
        since: m.joinedAt
          ? new Date(m.joinedAt).toLocaleDateString('en-GB', {
              month: 'short',
              year: 'numeric',
            })
          : 'Not recorded',
        verifyToken: m.verifyToken ?? '',
        isDemo: false,
      }));
  }, [backendSignedIn, localJoinedClubs, realMemberships, user]);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await hydrateProfile(data.session.user.id, data.session.user.email);
    }
  }, [hydrateProfile]);

  /** Re-read the real feed and the real follow list. */
  const refreshFeed = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) return;

    const [loaded, followed] = await Promise.all([
      loadFeedPosts(supabase, { viewerId: authUser.id, limit: 30 }),
      loadFollowedProfileIds(supabase, authUser.id),
    ]);

    setRealFollows(followed);
    // An empty feed is an honest empty state, not the demo dataset.
    setPosts(loaded);
  }, [authUser]);

  // The feed belongs to the signed-in student, so it loads with the session.
  useEffect(() => {
    if (!authUser) return;
    void refreshFeed();
  }, [authUser, refreshFeed]);

  // The people directory and the community list are public campus information,
  // so they load for everyone — signed in or not.

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setAuthUser(null);
    // Never let the next account on this device inherit the previous
    // student's privacy choices or conversations.
    setPrivacyState(DEFAULT_PRIVACY);
    preferenceWriteSeq.current += 1;
    setPreferencesLoading(false);
    setPreferencesSaving(false);
    setPreferencesError(null);
    if (isBackendConfigured()) {
      setConversations([]);
      setBlockedIds([]);
      setRealMemberships([]);
      setManagedClubs([]);
      setClubs([]);
      setHonours([]);
      setClubDirectoryError(null);
      setHonoursError(null);
      // The feed, follow list and notifications belong to the account that
      // just left — never show them to the next student on this device.
      setPosts([]);
      setRealFollows([]);
      setNotifications([]);
      setNotificationsLoading(false);
      setNotificationsError(null);
    }
  }, [setPrivacyState]);

  useEffect(() => {
    setReady(true);
    // Re-sync demo state with persisted saves so badges match on reload.
    setPosts((prev) =>
      prev.map((p) => ({ ...p, saved: saved.posts.includes(p.id) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'default') => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, text, tone }]);
    const timer = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
    toastTimers.current.push(timer);
  }, []);

  useEffect(
    () => () => {
      toastTimers.current.forEach(clearTimeout);
    },
    [],
  );

  /* --- Real inbox (Phase 3) ------------------------------------------------ */

  const refreshInbox = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // demo mode owns its local conversations
    if (!authUser) {
      setConversations([]);
      setBlockedIds([]);
      setInboxLoading(false);
      return;
    }

    setInboxLoading(true);
    const [inbox, blocks, archived] = await Promise.all([
      loadInbox(supabase, authUser.id),
      loadBlockedIds(supabase, authUser.id),
      loadArchivedIds(supabase, authUser.id),
    ]);

    // The student signed out or switched accounts while this request was in
    // flight. Drop the stale result instead of showing it to someone else.
    if (authUserIdRef.current !== authUser.id) return;

    const archivedIds = new Set(archived.ids);

    if (inbox.error) {
      setInboxError(inbox.error);
    } else {
      setInboxError(null);
      setConversations((prev) => {
        // Preserve already-loaded history when only inbox metadata refreshes.
        // Without this, the 30s inbox poll would wipe an open conversation.
        const byId = new Map(prev.map((c) => [c.id, c]));
        const merged = inbox.conversations.map((fresh) => {
          const old = byId.get(fresh.id);
          const archived = archivedIds.has(fresh.id);
          if (!old) return { ...fresh, archived };
          return {
            ...fresh,
            archived,
            messages: old.messages,
            messagesLoaded: old.messagesLoaded,
          };
        });

        // Group/plan chats are session-local until group messaging ships; keep
        // them visible alongside the real 1:1 inbox.
        const realIds = new Set(merged.map((c) => c.id));
        const local = prev.filter((c) => c.isLocal && !realIds.has(c.id));
        return [...merged, ...local];
      });
    }

    if (!blocks.error) setBlockedIds(blocks.ids);
    setInboxLoading(false);
  }, [authUser]);

  const refreshConversation = useCallback(
    async (conversationId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) return;

      const [inbox, history, pins] = await Promise.all([
        loadInbox(supabase, authUser.id),
        loadMessages(supabase, conversationId, authUser.id),
        supabase
          .from('pinned_messages')
          .select('message_id')
          .eq('conversation_id', conversationId)
          .order('pinned_at', { ascending: true }),
      ]);

      if (authUserIdRef.current !== authUser.id) return;

      // Pins are optional until migration 018 lands; a failure never blocks
      // the conversation itself — it just leaves the pinned list empty.
      if (pins.error) setPinnedMessages((prev) => ({ ...prev, [conversationId]: [] }));
      else {
        const ids = (pins.data ?? []).map((row) => String((row as { message_id: string }).message_id));
        setPinnedMessages((prev) => ({ ...prev, [conversationId]: ids }));
      }

      if (history.error) {
        pushToast(history.error, 'warning');
      }

      setConversations((prev) => {
        const fresh = inbox.conversations.find((c) => c.id === conversationId);
        const index = prev.findIndex((c) => c.id === conversationId);
        const base = fresh ?? prev[index];
        if (!base) return prev;

        const updated: Conversation = {
          ...base,
          messages: history.messages,
          messagesLoaded: true,
        };
        if (index === -1) return [updated, ...prev];
        return prev.map((c, i) => (i === index ? updated : c));
      });
    },
    [authUser, pushToast],
  );

  /* --- Real clubs & recognition (Phase 4) --------------------------------- */

  const refreshClubs = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setClubs(DEMO_CLUBS);
      setRealMemberships([]);
      setManagedClubs([]);
      setClubDirectoryError(null);
      setClubsLoading(false);
      return;
    }
    if (!authUser) {
      // Backend configured but signed out: the directory is public, so the
      // real clubs still show. No student data is involved.
      setClubsLoading(true);
      const directory = await loadClubDirectory(supabase);
      setClubs(directory.clubs);
      setRealMemberships([]);
      setManagedClubs([]);
      setClubDirectoryError(directory.error);
      setClubsLoading(false);
      return;
    }

    setClubsLoading(true);
    const [directory, state] = await Promise.all([
      loadClubDirectory(supabase),
      loadMyClubState(supabase),
    ]);
    if (authUserIdRef.current !== authUser.id) return;

    if (directory.error) {
      setClubDirectoryError(directory.error);
      setClubs([]);
    } else {
      setClubDirectoryError(null);
      setClubs(directory.clubs);
    }

    if (state.error) {
      setClubDirectoryError((prev) => prev ?? state.error);
    } else {
      setRealMemberships(state.memberships);
      setManagedClubs(state.managed);
    }
    setClubsLoading(false);
  }, [authUser]);

  /** Load Campus Pulse: who is around, and what people are planning. */
  const refreshPulse = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAvailability([]);
      setActivities([]);
      setCampusAreas([]);
      setPulseLoading(false);
      return;
    }

    setPulseLoading(true);
    const [around, plans, areas] = await Promise.all([
      loadAvailability(supabase, { viewerId: authUser?.id ?? null }),
      loadActivities(supabase, { viewerId: authUser?.id ?? null }),
      loadCampusAreas(supabase),
    ]);

    setAvailability(around);
    setActivities(plans);
    setCampusAreas(areas);
    setPulseLoading(false);
  }, [authUser]);

  const publishMyAvailability = useCallback(
    async (input: Omit<PublishAvailabilityInput, 'userId' | 'universityId'>) => {
      const supabase = getSupabaseBrowserClient();
      const universityId = user.primaryUniversityId;
      if (!supabase || !authUser) return { ok: false, error: 'Sign in to share your availability.' };
      if (!universityId) return { ok: false, error: 'Your account is not linked to a university yet.' };

      const result = await publishAvailability(supabase, {
        ...input,
        userId: authUser.id,
        universityId,
      });
      if (result.ok) {
        pushToast('You are on the pulse', 'success');
        void refreshPulse();
      } else {
        pushToast(result.error ?? 'Could not update your availability');
      }
      return result;
    },
    [authUser, pushToast, refreshPulse, user.primaryUniversityId],
  );

  const clearMyAvailability = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) return;
    await clearAvailability(supabase, authUser.id);
    pushToast('You are off the pulse');
    void refreshPulse();
  }, [authUser, pushToast, refreshPulse]);

  const createActivity = useCallback(
    async (input: Omit<CreateActivityInput, 'creatorId' | 'universityId'>) => {
      const supabase = getSupabaseBrowserClient();
      const universityId = user.primaryUniversityId;
      if (!supabase || !authUser) return { ok: false, error: 'Sign in to organise an activity.' };
      if (!universityId) return { ok: false, error: 'Your account is not linked to a university yet.' };

      const result = await createPulseActivity(supabase, {
        ...input,
        creatorId: authUser.id,
        universityId,
      });
      if (result.id) {
        pushToast('Activity published', 'success');
        void refreshPulse();
        return { ok: true };
      }
      pushToast(result.error ?? 'Could not create that activity');
      return { ok: false, error: result.error };
    },
    [authUser, pushToast, refreshPulse, user.primaryUniversityId],
  );

  const joinActivity = useCallback(
    async (planId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { ok: false };
      const result = await joinPulseActivity(supabase, planId);
      if (result.ok) {
        pushToast('You are going', 'success');
        void refreshPulse();
      } else {
        pushToast(result.error ?? 'Could not join that activity');
      }
      return result;
    },
    [pushToast, refreshPulse],
  );

  const leaveActivity = useCallback(
    async (planId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { ok: false };
      const result = await leavePulseActivity(supabase, planId);
      void refreshPulse();
      return result;
    },
    [refreshPulse],
  );

  const requestToJoin = useCallback(
    async (planId: string, note?: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) return { ok: false };
      const result = await requestToJoinActivity(supabase, { planId, userId: authUser.id, note });
      if (result.ok) {
        pushToast('Request sent to the organiser', 'success');
        void refreshPulse();
      } else {
        pushToast(result.error ?? 'Could not send that request');
      }
      return result;
    },
    [authUser, pushToast, refreshPulse],
  );

  const respondToJoinRequest = useCallback(
    async (requestId: string, planId: string, accept: boolean) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      await respondToPulseJoinRequest(supabase, { requestId, planId, accept });
      void refreshPulse();
    },
    [refreshPulse],
  );

  /** Load the notification centre — the rows the database wrote for this student. */
  const refreshNotifications = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      setNotifications(isBackendConfigured() ? [] : DEMO_NOTIFICATIONS);
      setNotificationsLoading(false);
      setNotificationsError(null);
      return;
    }

    setNotificationsLoading(true);
    const loaded = await loadNotifications(supabase, authUser.id);
    // Never let a slow response from a previous account populate this screen.
    if (authUserIdRef.current !== authUser.id) return;
    if (loaded.error) {
      setNotificationsError(loaded.error);
      setNotifications([]);
    } else {
      setNotificationsError(null);
      setNotifications(loaded.notifications);
    }
    setNotificationsLoading(false);
  }, [authUser]);

  /** Load the real people directory — the students this account may see. */  const refreshPeople = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPeople(DEMO_PEOPLE);
      setPeopleLoading(false);
      return;
    }

    setPeopleLoading(true);
    const loaded = await loadPeople(supabase, { viewerId: authUser?.id ?? null, limit: 40 });
    if (authUserIdRef.current !== (authUser?.id ?? null)) return;
    setPeople(loaded);
    setPeopleLoading(false);
  }, [authUser]);

  /** Load the real interest circles and course groups. */
  const refreshCommunities = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCircles(DEMO_CIRCLES);
      setGroups(DEMO_GROUPS);
      return;
    }

    const { circles: loadedCircles, groups: loadedGroups } = await loadCommunityGroups(supabase);
    setCircles(loadedCircles);
    setGroups(loadedGroups);
  }, []);

  /** Real circle/group memberships are account data, not device-local joins. */
  const refreshJoinedGroups = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      setRealJoinedGroupIds([]);
      return;
    }
    const { ids } = await loadJoinedGroupIds(supabase, authUser.id);
    if (authUserIdRef.current !== authUser.id) return;
    setRealJoinedGroupIds(ids);
  }, [authUser]);

  useEffect(() => {
    void refreshPeople();
    void refreshCommunities();
  }, [authUser, refreshPeople, refreshCommunities]);

  useEffect(() => {
    if (!authUser) return;
    void refreshNotifications();
  }, [authUser, refreshNotifications]);

  /** Bookmarks are account data, not a device-local list, for signed-in users. */
  const refreshSaved = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      if (isBackendConfigured()) setSaved(EMPTY_SAVED);
      return;
    }
    const loaded = await loadSavedState(supabase, authUser.id);
    if (authUserIdRef.current !== authUser.id) return;
    setSaved(loaded);
    setPosts((prev) => prev.map((p) => ({ ...p, saved: loaded.posts.includes(p.id) })));
  }, [authUser, setSaved]);

  useEffect(() => {
    void refreshSaved();
  }, [authUser, refreshSaved]);

  // Campus Pulse loads with the session and then listens for live changes,
  // so availability and activities update without polling.
  useEffect(() => {
    if (!authUser) {
      setAvailability([]);
      setActivities([]);
      // While the session is still restoring, keep the honest "checking" state
      // rather than claiming that nobody is around.
      setPulseLoading(authLoading);
      return;
    }
    void refreshPulse();
    const supabase = getSupabaseBrowserClient();
    const unsubscribe = subscribeToPulse(supabase, () => {
      void refreshPulse();
    });
    return () => {
      unsubscribe?.();
    };
  }, [authLoading, authUser, refreshPulse]);

  const refreshHonours = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      setHonours(isBackendConfigured() ? [] : DEMO_HONOURS);
      setHonoursError(null);
      setHonoursLoading(false);
      return;
    }

    setHonoursLoading(true);
    const result = await loadHonours(supabase);
    if (authUserIdRef.current !== authUser.id) return;
    setHonours(result.honours);
    setHonoursError(result.error);
    setHonoursLoading(false);
  }, [authUser]);

  const applyToClub = useCallback(
    async (slug: string, note?: string) => {
      const club = clubs.find((c) => c.slug === slug);
      if (!club) {
        pushToast('That club is not available in this deployment', 'warning');
        return;
      }
      if (isBackendConfigured() && !authUser) {
        pushToast('Sign in to apply to a club', 'warning');
        return;
      }

      // Demo mode: keep the clearly-labelled local experience.
      if (!isBackendConfigured()) {
        if (localClubApplications.includes(slug)) {
          pushToast('Application already sent — awaiting the committee');
          return;
        }
        setLocalClubApplications([...localClubApplications, slug]);
        pushToast('Application sent — the club committee will review it', 'success');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !club.organizationId) {
        pushToast('Club data is not available yet', 'warning');
        return;
      }

      const result = await applyToOrganization(supabase, club.organizationId, note);
      if (result.error) {
        pushToast(result.error, 'warning');
        return;
      }

      setRealMemberships((prev) => [
        ...prev.filter((m) => m.organizationId !== club.organizationId),
        {
          organizationId: club.organizationId!,
          slug: club.slug,
          name: club.name,
          status: result.status ?? 'pending',
          role: 'Member',
          joinedAt: new Date().toISOString(),
          verifyToken: null,
          category: club.category,
          verificationStatus: club.verificationStatus,
        },
      ]);
      pushToast('Application sent — the club committee will review it', 'success');
      await refreshClubs();
    },
    [
      clubs,
      authUser,
      localClubApplications,
      setLocalClubApplications,
      pushToast,
      refreshClubs,
    ],
  );

  const withdrawClubApplication = useCallback(
    async (slug: string) => {
      const club = clubs.find((c) => c.slug === slug);
      if (isBackendConfigured() && !authUser) {
        pushToast('Sign in to withdraw an application', 'warning');
        return;
      }
      if (!isBackendConfigured()) {
        setLocalClubApplications(localClubApplications.filter((s) => s !== slug));
        pushToast('Application withdrawn');
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !club?.organizationId) {
        pushToast('Club data is not available yet', 'warning');
        return;
      }
      const result = await withdrawClubApplicationRpc(supabase, club.organizationId);
      if (result.error) {
        pushToast(result.error, 'warning');
        return;
      }
      setRealMemberships((prev) => prev.filter((m) => m.organizationId !== club.organizationId));
      pushToast('Application withdrawn');
      await refreshClubs();
    },
    [
      clubs,
      authUser,
      localClubApplications,
      setLocalClubApplications,
      pushToast,
      refreshClubs,
    ],
  );

  const leaveClub = useCallback(
    async (slug: string) => {
      const club = clubs.find((c) => c.slug === slug);
      if (isBackendConfigured() && !authUser) {
        pushToast('Sign in to leave a club', 'warning');
        return;
      }
      if (!isBackendConfigured()) {
        setLocalJoinedClubs(localJoinedClubs.filter((s) => s !== slug));
        pushToast('You left the club');
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !club?.organizationId) {
        pushToast('Club data is not available yet', 'warning');
        return;
      }
      const result = await leaveOrganization(supabase, club.organizationId);
      if (result.error) {
        pushToast(result.error, 'warning');
        return;
      }
      setRealMemberships((prev) =>
        prev.map((m) =>
          m.organizationId === club.organizationId
            ? { ...m, status: result.status ?? 'alumni' }
            : m,
        ),
      );
      pushToast('You left the club');
      await refreshClubs();
    },
    [clubs, authUser, localJoinedClubs, setLocalJoinedClubs, pushToast, refreshClubs],
  );

  const reviewClubApplication = useCallback(
    async (
      membershipId: string,
      decision: 'approved' | 'rejected' | 'pending',
      role?: string,
      note?: string,
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) {
        pushToast('Sign in as a club representative to review applications', 'warning');
        return false;
      }
      const result = await reviewClubApplicationRpc(
        supabase,
        membershipId,
        decision,
        role,
        note,
      );
      if (result.error) {
        pushToast(result.error, 'warning');
        return false;
      }
      pushToast(
        decision === 'approved'
          ? 'Application approved — membership card issued'
          : decision === 'rejected'
            ? 'Application rejected'
            : 'Application kept on hold',
        'success',
      );
      await refreshClubs();
      return true;
    },
    [authUser, pushToast, refreshClubs],
  );

  const setClubMemberRole = useCallback(
    async (membershipId: string, role: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) {
        pushToast('Sign in as a club representative to update roles', 'warning');
        return false;
      }
      const result = await setClubMemberRoleRpc(supabase, membershipId, role);
      if (result.error) {
        pushToast(result.error, 'warning');
        return false;
      }
      pushToast('Member role updated', 'success');
      return true;
    },
    [authUser, pushToast],
  );

  const awardClubHonour = useCallback(
    async (input: {
      organizationId: string;
      personId: string;
      category: HonourCategory;
      title: string;
      detail?: string;
      points: number;
      semester: string;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) {
        pushToast('Sign in as a club representative to award recognition', 'warning');
        return false;
      }
      const result = await awardClubHonourRpc(supabase, input);
      if (result.error) {
        pushToast(result.error, 'warning');
        return false;
      }
      pushToast('Recognition awarded and published to Campus Honours', 'success');
      await refreshHonours();
      return true;
    },
    [authUser, pushToast, refreshHonours],
  );

  const requestClubVerification = useCallback(
    async (slug: string, notes?: string) => {
      const club = clubs.find((c) => c.slug === slug);
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) {
        pushToast('Sign in as a club representative to request a review', 'warning');
        return false;
      }
      if (!club?.organizationId) {
        pushToast('Club data is not available yet', 'warning');
        return false;
      }
      const result = await requestClubVerificationRpc(supabase, club.organizationId, notes);
      if (result.error) {
        pushToast(result.error, 'warning');
        return false;
      }
      pushToast('Verification review requested — the university will review it', 'success');
      return true;
    },
    [clubs, authUser, pushToast],
  );

  // Load the real inbox whenever the signed-in student changes. Demo mode
  // keeps DEMO_CONVERSATIONS from the initial state.
  useEffect(() => {
    authUserIdRef.current = authUser?.id ?? null;
    if (!isBackendConfigured()) return;
    if (!authUser) {
      setConversations([]);
      setBlockedIds([]);
      setInboxLoading(false);
      return;
    }
    void refreshInbox();
  }, [authUser, refreshInbox]);

  // Real club state follows the account. In demo mode both helpers keep the
  // clearly-labelled demo dataset.
  useEffect(() => {
    void refreshClubs();
    void refreshHonours();
    void refreshJoinedGroups();
  }, [authUser, refreshClubs, refreshHonours, refreshJoinedGroups]);

  /**
   * Write preferences to this account's own `user_preferences` row. With no
   * signed-in student nothing is written, so a demo browser never claims an
   * account change was saved. Only the most recent write reports its state.
   */
  const persistPreferences = useCallback(
    async (values: PrivacyPrefs): Promise<boolean> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) return true;
      const seq = ++preferenceWriteSeq.current;
      setPreferencesSaving(true);
      setPreferencesError(null);
      const result = await saveUserPreferences(supabase, { userId: authUser.id, values });
      if (seq !== preferenceWriteSeq.current) return result.ok;
      setPreferencesSaving(false);
      if (!result.ok) {
        setPreferencesError(result.error ?? 'Could not save your preferences.');
        pushToast('Could not save your preferences — please try again.', 'warning');
      }
      return result.ok;
    },
    [authUser, pushToast],
  );

  const retrySavePreferences = useCallback(async () => {
    await persistPreferences(privacy);
  }, [persistPreferences, privacy]);

  const setPrivacy = useCallback(
    (p: Partial<PrivacyPrefs>): Promise<boolean> => {
      const next = { ...privacy, ...p };
      const honoursChanged =
        p.showInHonours !== undefined && p.showInHonours !== privacy.showInHonours;
      setPrivacyState(next);

      const saved = persistPreferences(next);
      void saved.then((ok) => {
        // Opting back in brings the student's real recognition back without a
        // reload; the honours feed itself enforces the opt-out.
        if (ok && honoursChanged) void refreshHonours();
      });
      return saved;
    },
    [privacy, setPrivacyState, persistPreferences, refreshHonours],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const isFollowing = useCallback((id: string) => follows.includes(id), [follows]);
  const toggleFollow = useCallback(
    (personId: string) => {
      const has = follows.includes(personId);
      const person = DEMO_PEOPLE.find((p) => p.id === personId);
      const name = person?.name ?? (isUuid(personId) ? 'this student' : 'account');

      if (backendSignedIn) {
        // The follow lives in the database, so it survives other devices.
        setRealFollows((current) =>
          has ? current.filter((f) => f !== personId) : [...current, personId],
        );
        void (async () => {
          const supabase = getSupabaseBrowserClient();
          if (!supabase || !authUser) return;
          const result = await setFollow(supabase, {
            followerId: authUser.id,
            targetId: personId,
            following: !has,
          });
          if (!result.ok) {
            setRealFollows((current) =>
              has ? [...current, personId] : current.filter((f) => f !== personId),
            );
            pushToast('Could not update that follow — please try again.');
          }
        })();
      } else {
        setLocalFollows(has ? follows.filter((f) => f !== personId) : [...follows, personId]);
      }

      pushToast(
        has ? `Unfollowed ${name}` : `Following ${name} — their posts appear in Following`,
        has ? 'default' : 'success',
      );
      return !has;
    },
    [authUser, backendSignedIn, follows, pushToast, setLocalFollows],
  );

  const toggleJoinCircle = useCallback(
    (slug: string) => {
      const has = joinedCircles.includes(slug);
      const next = !has;

      // A real circle has a UUID slug; write only the signed-in student's own
      // membership and roll the optimistic state back if the database refuses.
      if (backendSignedIn && authUser?.id && isUuid(slug)) {
        setRealJoinedGroupIds((prev) =>
          next ? [...new Set([...prev, slug])] : prev.filter((id) => id !== slug),
        );
        const client = getSupabaseBrowserClient();
        if (client) {
          void setCircleMembership(client, {
            groupId: slug,
            userId: authUser.id,
            join: next,
          }).then((result) => {
            if (!result.ok) {
              setRealJoinedGroupIds((prev) =>
                has ? [...new Set([...prev, slug])] : prev.filter((id) => id !== slug),
              );
              pushToast(result.error ?? 'Could not update your circle membership.', 'warning');
              return;
            }
            pushToast(next ? 'Joined the circle' : 'Left the circle', next ? 'success' : 'default');
          });
        }
        return next;
      }

      setJoins(has ? joins.filter((j) => j !== slug) : [...joins, slug]);
      pushToast(has ? 'Left the circle' : 'Joined the circle', has ? 'default' : 'success');
      return next;
    },
    [authUser?.id, backendSignedIn, joinedCircles, joins, pushToast, setJoins],
  );

  const toggleJoinGroup = useCallback(
    (slug: string) => {
      const has = joinedGroups.includes(slug);
      const next = !has;

      if (backendSignedIn && authUser?.id && isUuid(slug)) {
        setRealJoinedGroupIds((prev) =>
          next ? [...new Set([...prev, slug])] : prev.filter((id) => id !== slug),
        );
        const client = getSupabaseBrowserClient();
        if (client) {
          void setCircleMembership(client, {
            groupId: slug,
            userId: authUser.id,
            join: next,
          }).then((result) => {
            if (!result.ok) {
              setRealJoinedGroupIds((prev) =>
                has ? [...new Set([...prev, slug])] : prev.filter((id) => id !== slug),
              );
              pushToast(result.error ?? 'Could not update your group membership.', 'warning');
              return;
            }
            pushToast(next ? 'Joined the group' : 'Left the group', next ? 'success' : 'default');
          });
        }
        return next;
      }

      setJoins(has ? joins.filter((j) => j !== slug) : [...joins, slug]);
      pushToast(has ? 'Left the group' : 'Joined the group', has ? 'default' : 'success');
      return next;
    },
    [authUser?.id, backendSignedIn, joinedGroups, joins, pushToast, setJoins],
  );

  /* --- CAMPUS ORBIT actions -------------------------------------------------- */

  const promoteCircle = useCallback(
    (slug: string) => {
      const has = promotedCircles.includes(slug);
      if (!has) {
        setPromotedCircles([...promotedCircles, slug]);
        if (!joins.includes(slug)) setJoins([...joins, slug]);
        pushToast('Circle made permanent — welcome home', 'success');
        return true;
      }
      return false;
    },
    [promotedCircles, setPromotedCircles, joins, setJoins, pushToast],
  );

  const planConversationId = useCallback(
    (planId: string) => conversations.find((c) => c.planId === planId)?.id ?? null,
    [conversations],
  );

  const ensurePlanConversation = useCallback(
    (plan: ActivityPlan, existing: Conversation[]) => {
      if (existing.some((c) => c.planId === plan.id)) return existing;
      const id = `cv-plan-${plan.id}`;
      const others = plan.participants.filter((p) => p !== 'me');
      const conv: Conversation = {
        id,
        kind: 'plan',
        title: `Plan · ${plan.title}`,
        participants: others,
        avatarSeeds: others,
        unread: 0,
        pinned: false,
        muted: false,
        request: 'none',
        messages: [
          {
            id: `pm-${plan.id}`,
            senderId: plan.createdBy === 'me' ? 'me' : plan.createdBy,
            text: `Plan created — ${plan.title}. Meeting at ${plan.spot}. ${plan.note}`,
            createdAt: plan.createdAt,
          },
        ],
        planId: plan.id,
        isDemo: plan.isDemo,
      };
      return [conv, ...existing];
    },
    [],
  );

  const createPlan = useCallback(
    (input: {
      title: string;
      category: ActivityPlan['category'];
      spot: string;
      startsAt: string;
      durationMins: number;
      participantLimit: number;
      note: string;
    }) => {
      const id = `plan-${Date.now().toString(36)}`;
      const plan: ActivityPlan = {
        id,
        title: input.title,
        category: input.category,
        spot: input.spot,
        startsAt: input.startsAt,
        durationMins: input.durationMins,
        participantLimit: input.participantLimit,
        createdBy: 'me',
        participants: ['me'],
        note: input.note,
        createdAt: new Date().toISOString(),
        isDemo: false,
      };
      setPlans((prev) => [plan, ...prev]);
      setConversations((prev) => ensurePlanConversation(plan, prev));
      pushToast('Plan created — the group chat is ready', 'success');
      return id;
    },
    [ensurePlanConversation, pushToast],
  );

  const joinPlan = useCallback(
    (id: string) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return false;
      if (plan.participants.includes('me')) return true;
      if (plan.participants.length >= plan.participantLimit) {
        pushToast('This plan is full', 'warning');
        return false;
      }
      const updated = { ...plan, participants: [...plan.participants, 'me'] };
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setConversations((prev) => ensurePlanConversation(updated, prev));
      pushToast('You joined the plan', 'success');
      return true;
    },
    [plans, ensurePlanConversation, pushToast],
  );

  const leavePlan = useCallback(
    (id: string) => {
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, participants: p.participants.filter((x) => x !== 'me') } : p)),
      );
      pushToast('You left the plan');
      return true;
    },
    [pushToast],
  );

  const toggleSaved = useCallback(
    async (
      key: keyof SavedState,
      id: string,
      savedLabel: string,
      removedLabel: string,
    ): Promise<boolean> => {
      const has = saved[key].includes(id);
      const next = !has;
      const supabase = getSupabaseBrowserClient();
      const realAccount = Boolean(supabase && authUser);

      if (realAccount && supabase && authUser) {
        const ok = await setSavedItem(supabase, authUser.id, key, id, next);
        if (!ok) {
          pushToast('Could not update your saved list. Please try again.');
          return has;
        }
      }

      setSaved((prev) => ({
        ...prev,
        [key]: next ? [...prev[key], id] : prev[key].filter((x) => x !== id),
      }));
      if (key === 'posts') {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved: next } : p)));
      }
      pushToast(next ? savedLabel : removedLabel, next ? 'success' : 'default');
      return next;
    },
    [authUser, pushToast, saved, setSaved],
  );

  const toggleSavePost = useCallback(
    (id: string) => toggleSaved('posts', id, 'Saved — find it in Saved Posts', 'Removed from Saved'),
    [toggleSaved],
  );

  const toggleSaveRoom = useCallback(
    (id: string) => toggleSaved('rooms', id, 'Saved room', 'Removed from Saved Rooms'),
    [toggleSaved],
  );

  const toggleSaveProduct = useCallback(
    (id: string) => toggleSaved('products', id, 'Saved item', 'Removed from Saved items'),
    [toggleSaved],
  );

  const setPins = useCallback((next: PinKey[]) => setPinsState(next), [setPinsState]);
  const resetPins = useCallback(() => {
    setPinsState(DEFAULT_PINS);
    pushToast('Pins reset to default');
  }, [setPinsState, pushToast]);

  const addPost = useCallback(
    (p: {
      body: string;
      media: string[];
      files?: File[];
      audience: Post['audience'];
      circleSlug?: string;
    }) => {
      const localId = `my-post-${Date.now()}`;
      const optimistic: Post = {
        id: localId,
        authorId: user.id,
        authorName: user.name,
        authorRole: `${user.isVerified ? 'Verified Student' : 'Student'} • ${user.departmentCode} ${user.semester}`,
        originBadge: 'Student Community Post',
        departmentCode: user.departmentCode,
        circleSlug: p.circleSlug,
        scope: p.audience === 'University' ? 'University' : p.audience === 'My Department' ? 'My Department' : 'My Circles',
        category: 'Student Discussion',
        createdAt: new Date().toISOString(),
        body: p.body,
        media: p.media,
        audience: p.audience,
        reactions: {},
        myReaction: null,
        saved: false,
        comments: [],
        isDemo: false,
      };

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isBackendConfigured()) {
        setPosts((prev) => [optimistic, ...prev]);
        pushToast('Posted to your campus feed', 'success');
        return;
      }

      // Real post: photographs first, then the post that carries them.
      void (async () => {
        const mediaUrls: string[] = [];
        for (const file of p.files ?? []) {
          const uploaded = await uploadPostPhoto(supabase, { file });
          if (uploaded.error) {
            pushToast('That photograph could not be uploaded.');
            break;
          }
          if (uploaded.url) mediaUrls.push(uploaded.url);
        }

        const visibility =
          p.audience === 'My Department' ? 'department' : p.audience === 'My Circles' ? 'organization' : 'university';

        const universityId = user.primaryUniversityId;
        if (!universityId) {
          pushToast('Your account is not linked to a university yet — please contact the office.');
          return;
        }

        const { error } = await publishPost(supabase, {
          authorId: authUser.id,
          universityId,
          departmentId: user.departmentId ?? null,
          body: p.body,
          visibility,
          mediaUrls,
        });

        if (error) {
          pushToast('Could not publish that post — please try again.');
          return;
        }

        setPosts((prev) => [optimistic, ...prev.filter((post) => post.id !== localId)]);
        pushToast('Posted to your campus feed', 'success');
        void refreshFeed();
      })();
    },
    [authUser, pushToast, refreshFeed, user],
  );

  const react = useCallback(
    (postId: string, reaction: ReactionType) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const counts = { ...p.reactions };
          if (p.myReaction) counts[p.myReaction] = Math.max(0, (counts[p.myReaction] ?? 1) - 1);
          if (p.myReaction === reaction) {
            return { ...p, reactions: counts, myReaction: null };
          }
          counts[reaction] = (counts[reaction] ?? 0) + 1;
          return { ...p, reactions: counts, myReaction: reaction };
        }),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(postId)) return;
      void (async () => {
        const result = await setPostReaction(supabase, {
          postId,
          userId: authUser.id,
          reaction,
        });
        if (!result.ok) pushToast('Could not save that reaction — please try again.');
      })();
    },
    [authUser, pushToast],
  );

  const reactToComment = useCallback(
    (postId: string, commentId: string, reaction: ReactionType) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            comments: p.comments.map((c) => {
              if (c.id !== commentId) return c;
              const counts = { ...(c.reactions ?? {}) };
              if (c.myReaction) counts[c.myReaction] = Math.max(0, (counts[c.myReaction] ?? 1) - 1);
              if (c.myReaction === reaction) {
                return { ...c, reactions: counts, myReaction: null };
              }
              counts[reaction] = (counts[reaction] ?? 0) + 1;
              return { ...c, reactions: counts, myReaction: reaction };
            }),
          };
        }),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(commentId)) return;
      void (async () => {
        const result = await setCommentReaction(supabase, {
          commentId,
          userId: authUser.id,
          reaction,
        });
        if (!result.ok) pushToast('Could not save that reaction — please try again.');
      })();
    },
    [authUser, pushToast],
  );

  const toggleContextAction = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, myContextAction: !p.myContextAction } : p)),
    );
  }, []);

  const addComment = useCallback(
    (postId: string, text: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: `c-${Date.now()}`,
                    author: user.name,
                    authorRole: 'You',
                    text,
                    createdAt: new Date().toISOString(),
                    isMine: true,
                    reactions: {},
                    myReaction: null,
                  },
                ],
              }
            : p,
        ),
      );
      pushToast('Comment posted');

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(postId)) return;
      void (async () => {
        const result = await publishComment(supabase, {
          postId,
          authorId: authUser.id,
          body: text,
        });
        if (result.error) {
          pushToast('Could not post that comment — please try again.');
          return;
        }
        void refreshFeed();
      })();
    },
    [authUser, pushToast, refreshFeed, user.name],
  );

  const editComment = useCallback(
    (postId: string, commentId: string, text: string) => {
      const body = text.trim();
      if (!body) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId ? { ...c, text: body, createdAt: new Date().toISOString() } : c,
                ),
              }
            : p,
        ),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(commentId)) return;
      void (async () => {
        const result = await editCommentBody(supabase, { commentId, body });
        if (!result.ok) {
          pushToast('Could not edit that comment — please try again.');
          return;
        }
        void refreshFeed();
      })();
    },
    [authUser, pushToast, refreshFeed],
  );

  const deleteComment = useCallback(
    (postId: string, commentId: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
            : p,
        ),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !isUuid(commentId)) return;
      void (async () => {
        const result = await removeComment(supabase, { commentId });
        if (!result.ok) pushToast('Could not delete that comment — please try again.');
      })();
    },
    [pushToast],
  );

  const hidePost = useCallback(
    (postId: string) => {
      setHiddenPostIds((h) => [...h, postId]);
      // Hidden-post state is not persisted to a backend path in this schema,
      // so on a connected campus this hides the post for this session only.
      pushToast(
        isBackendConfigured()
          ? 'Post hidden for this session only.'
          : 'Post hidden — you will see fewer like this',
      );
    },
    [pushToast],
  );

  const muteAccount = useCallback(
    (authorId: string) => {
      setMutedAccountIds((m) => [...m, authorId]);
      // Mute is not persisted to a backend path in this schema, so it lasts
      // for this session only on a connected campus.
      pushToast(
        isBackendConfigured()
          ? 'Account muted for this session only.'
          : 'Account muted — their posts stay out of your feeds',
      );
    },
    [pushToast],
  );

  const showLessLikeThis = useCallback(
    (postId: string) => {
      setHiddenPostIds((h) => [...h, postId]);
      // Same as hidePost: session-only on a connected campus.
      pushToast(
        isBackendConfigured() ? 'Shown less for this session only.' : 'Thanks — showing less like this',
      );
    },
    [pushToast],
  );

  const reportContent = useCallback(
    (what: string, target?: { targetType: string; targetId: string; reason?: string }) => {
      const supabase = getSupabaseBrowserClient();
      const universityId = user.primaryUniversityId;
      if (supabase && authUser && universityId && target && isUuid(target.targetId)) {
        void (async () => {
          const { error } = await supabase.from('reports').insert({
            university_id: universityId,
            reporter_id: authUser.id,
            target_type: target.targetType,
            target_id: target.targetId,
            reason_category: target.reason ?? 'spam',
            details: what,
          });
          pushToast(
            error
              ? 'Could not send the report — please try again.'
              : 'Report received — the moderation team will review it.',
            error ? 'warning' : 'success',
          );
        })();
        return;
      }
      // Honest fallback: the `reports` table has a client INSERT policy only
      // after migration 015 is applied; until then nothing can be submitted.
      pushToast('Content reporting is not available yet — nothing was submitted.', 'warning');
    },
    [authUser, pushToast, user.primaryUniversityId],
  );

  // Real-time ping only: no message content is broadcast. Recipients re-fetch
  // through the authorized loaders, so privacy never depends on the ping.
  const broadcastPing = useCallback(
    (conversationId: string, otherUserId?: string | null) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const fire = (name: string, event: string) => {
        const channel = supabase.channel(name);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel.send({ type: 'broadcast', event, payload: {} });
            void supabase.removeChannel(channel);
          }
        });
      };
      fire(`conversation:${conversationId}`, 'ping');
      if (otherUserId && isUuid(otherUserId)) fire(`user:${otherUserId}:inbox`, 'refresh');
    },
    [],
  );

  // Edit own message. Requires migration 017 (author-only, 15-minute window).
  // Until it is applied the RPC does not exist and the app says so honestly.
  const editMessage = useCallback(
    async (conversationId: string, messageId: string, text: string) => {
      const body = text.trim();
      if (!body) return false;
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(messageId)) {
        pushToast('Editing is not available for this conversation.', 'warning');
        return false;
      }
      const { data, error } = await supabase.rpc('edit_message', {
        p_message_id: messageId,
        p_body: body,
      });
      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        return false;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, text: body, editedAt: new Date().toISOString() }
                    : m,
                ),
              }
            : c,
        ),
      );
      broadcastPing(conversationId, conversations.find((c) => c.id === conversationId)?.participants[0]);
      return Boolean(data ?? true);
    },
    [authUser, broadcastPing, conversations, pushToast],
  );

  // Delete own message for everyone (soft delete: "This message was deleted").
  // Author-only, same 15-minute window; migration 017 required.
  const deleteMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(messageId)) return false;
      const { error } = await supabase.rpc('delete_message', { p_message_id: messageId });
      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        return false;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, text: '', photo: undefined, deletedAt: new Date().toISOString() }
                    : m,
                ),
              }
            : c,
        ),
      );
      broadcastPing(conversationId, conversations.find((c) => c.id === conversationId)?.participants[0]);
      return true;
    },
    [authUser, broadcastPing, conversations, pushToast],
  );

  const sendMessage = useCallback(
    async (conversationId: string, text: string, photo?: string, photoFile?: File) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) {
        pushToast('This conversation is still loading. Please try again.', 'warning');
        return false;
      }

      const supabase = getSupabaseBrowserClient();
      const shouldBeReal = Boolean(supabase && authUser && !conv.isDemo && !conv.isLocal);
      if (shouldBeReal && !isUuid(conversationId)) {
        pushToast('This conversation is not available.', 'warning');
        return false;
      }
      const real = shouldBeReal;

      if (!real) {
        // Demo mode and session-local group/plan chats stay in this session.
        const msg: Message = {
          id: `m-${Date.now()}`,
          senderId: 'me',
          text,
          photo,
          audio: Boolean(photoFile?.type?.startsWith('audio/') || (photoFile && isAudioPath(photoFile.name))),
          replyToId: replyTo ?? undefined,
          createdAt: new Date().toISOString(),
          read: true,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.some((m) => m.id === msg.id)
                    ? c.messages
                    : [...c.messages, msg],
                  lastMessage: msg,
                  unread: 0,
                }
              : c,
          ),
        );
        setReplyTo(null);
        return true;
      }

      if (!supabase || !authUser) return false;

      if (conv?.request !== 'none') {
        pushToast('Wait for the message request to be accepted before replying.', 'warning');
        return false;
      }

      let photoPath: string | undefined;
      if (photoFile) {
        const upload = await uploadMessagePhoto(supabase, conversationId, authUser.id, photoFile);
        if (upload.error || !upload.path) {
          pushToast(upload.error ?? 'Photo upload failed. Please try again.', 'warning');
          return false;
        }
        photoPath = upload.path;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: authUser.id,
          body: text,
          photo_url: photoPath ?? null,
          reply_to_id: isUuid(replyTo) ? replyTo : null,
        })
        .select('id, conversation_id, sender_id, body, is_read, created_at, photo_url, reply_to_id')
        .single();

      if (error || !data) {
        pushToast(friendlyMessagingError(error?.message), 'warning');
        return false;
      }

      const msg = mapMessageRow(data as unknown as MessageRow, authUser.id);
      // Keep the local preview visible immediately; a reload resolves the
      // private path to a signed URL instead.
      if (photo) msg.photo = photo;
      broadcastPing(conversationId, conv?.participants[0]);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.some((m) => m.id === msg.id)
                  ? c.messages
                  : [...c.messages, msg],
                lastMessage: msg,
                unread: 0,
              }
            : c,
        ),
      );
      setReplyTo(null);
      return true;
    },
    [authUser, conversations, pushToast, replyTo, broadcastPing],
  );

  // Forward a message to another conversation with an explicit attribution line.
  const forwardMessage = useCallback(
    async (targetConversationId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      return sendMessage(targetConversationId, `↪ Forwarded: ${trimmed}`);
    },
    [sendMessage],
  );

  const reactToMessage = useCallback(
    async (conversationId: string, messageId: string, emoji: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        reactions: m.reactions?.includes(emoji)
                          ? m.reactions.filter((e) => e !== emoji)
                          : [...(m.reactions ?? []), emoji],
                      }
                    : m,
                ),
              }
            : c,
        ),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(messageId)) return;

      const { error } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      });
      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        await refreshConversation(conversationId);
      }
    },
    [authUser, pushToast, refreshConversation],
  );

  const acceptRequest = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const supabase = getSupabaseBrowserClient();

      if (supabase && authUser && conv && !conv.isDemo && !conv.isLocal && isUuid(conversationId)) {
        const { error } = await supabase.rpc('respond_to_message_request', {
          p_conversation_id: conversationId,
          p_accept: true,
        });
        if (error) {
          pushToast(friendlyMessagingError(error.message), 'warning');
          return;
        }
        await refreshConversation(conversationId);
        pushToast('Message request accepted', 'success');
        return;
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, request: 'none', messages: c.messages.map((m) => ({ ...m, read: true })) }
            : c,
        ),
      );
      pushToast('Message request accepted', 'success');
    },
    [authUser, conversations, pushToast, refreshConversation],
  );

  const declineRequest = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const supabase = getSupabaseBrowserClient();

      if (supabase && authUser && conv && !conv.isDemo && !conv.isLocal && isUuid(conversationId)) {
        const { error } = await supabase.rpc('respond_to_message_request', {
          p_conversation_id: conversationId,
          p_accept: false,
        });
        if (error) {
          pushToast(friendlyMessagingError(error.message), 'warning');
          return;
        }
        await refreshInbox();
        pushToast('Message request declined');
        return;
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, request: 'declined' } : c)),
      );
      pushToast('Message request declined');
    },
    [authUser, conversations, pushToast, refreshInbox],
  );

  const startConversation = useCallback(
    async (opts: {
      personId: string;
      title: string;
      context?: Conversation['context'];
      kind?: Conversation['kind'];
      initialNote: string;
      introductionId?: string;
    }) => {
      if (blockedIds.includes(opts.personId)) {
        pushToast('You blocked this person — unblock them first', 'warning');
        return '';
      }

      const kind = opts.kind ?? 'direct';
      const supabase = getSupabaseBrowserClient();
      const groupLike = kind === 'group' || kind === 'plan';

      if (isBackendConfigured() && !authUser) {
        pushToast('Sign in to start a conversation', 'warning');
        return '';
      }

      if (!supabase || !authUser) {
        // Clearly-labelled demo mode: conversations stay in this session.
        const id = `cv-new-${Date.now()}`;
        const msg: Message = {
          id: `m-${Date.now()}`,
          senderId: 'me',
          text: opts.initialNote,
          createdAt: new Date().toISOString(),
          read: true,
        };
        setConversations((prev) => [
          {
            id,
            kind,
            title: opts.title,
            participants: [opts.personId],
            avatarSeeds: [opts.personId],
            unread: 0,
            pinned: false,
            muted: false,
            // Demo people cannot accept a request, so a demo conversation is
            // simply an open demo chat — never a fake pending consent state.
            request: 'none',
            messages: [msg],
            lastMessage: msg,
            messagesLoaded: true,
            context: opts.context,
            introductionId: opts.introductionId,
            isDemo: true,
          },
          ...prev,
        ]);
        pushToast(
          groupLike
            ? 'Group chat created for this session'
            : 'Demo conversation opened for this session',
        );
        return id;
      }

      if (groupLike) {
        // Group/plan chats are not server-synced yet. Keep them working in
        // this session and label them honestly in the UI.
        const id = `cv-local-${Date.now()}`;
        const msg: Message = {
          id: `m-${Date.now()}`,
          senderId: 'me',
          text: opts.initialNote,
          createdAt: new Date().toISOString(),
          read: true,
        };
        setConversations((prev) => [
          {
            id,
            kind,
            title: opts.title,
            participants: [opts.personId],
            avatarSeeds: [opts.personId],
            unread: 0,
            pinned: false,
            muted: false,
            request: 'none',
            messages: [msg],
            lastMessage: msg,
            messagesLoaded: true,
            context: opts.context,
            introductionId: opts.introductionId,
            isLocal: true,
            // Group/plan content is still the labelled demo dataset, so the
            // chat is both session-local and demo — never implied to be a
            // real persisted group.
            isDemo: true,
          },
          ...prev,
        ]);
        pushToast('Group chat saved for this session — group sync arrives in a later phase');
        return id;
      }

      if (!isUuid(opts.personId)) {
        pushToast('That profile is demo content, not a real student account yet.', 'warning');
        return '';
      }

      const { data, error } = await supabase.rpc('start_conversation', {
        p_other_id: opts.personId,
        p_initial_note: opts.initialNote,
        p_context: opts.context ?? null,
        p_kind: kind,
      });

      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        return '';
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        | { conversation_id?: string; request_state?: string }
        | null;
      if (!row?.conversation_id) {
        pushToast('Could not start the conversation. Please try again.', 'warning');
        return '';
      }

      await refreshInbox();
      if (row.request_state === 'incoming') {
        pushToast('This student already sent you a request — open the chat to respond.', 'warning');
      } else {
        pushToast(
          row.request_state === 'sent' ? 'Message request sent' : 'Conversation started',
          'success',
        );
      }
      return row.conversation_id;
    },
    [authUser, blockedIds, pushToast, refreshInbox],
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(conversationId)) return;
      const { error } = await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
      });
      if (error) {
        // The next inbox refresh re-syncs the unread count honestly.
      }
    },
    [authUser],
  );

  /* --- Chats: pin / mute / block (§8) -------------------------------------- */

  const saveConversationSetting = useCallback(
    async (
      conversationId: string,
      patch: { pinned?: boolean; muted?: boolean; archived?: boolean },
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(conversationId)) return;

      const { error } = await supabase.from('conversation_settings').upsert(
        {
          user_id: authUser.id,
          conversation_id: conversationId,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,conversation_id' },
      );
      if (error) pushToast(friendlyMessagingError(error.message), 'warning');
    },
    [authUser, pushToast],
  );

  const toggleConversationPin = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const pinned = !conv?.pinned;
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, pinned } : c)));
      pushToast(pinned ? 'Pinned to the top of Chats' : 'Pin removed');
      await saveConversationSetting(conversationId, { pinned });
    },
    [conversations, pushToast, saveConversationSetting],
  );

  const toggleConversationArchive = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const archived = !conv?.archived;
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, archived } : c)),
      );
      // A client upsert only touches this user's row — the other participant
      // never sees or loses anything because of it.
      pushToast(archived ? 'Archived — find it in the Archived tab' : 'Restored to your inbox');
      await saveConversationSetting(conversationId, { archived });
    },
    [conversations, pushToast, saveConversationSetting],
  );

  const toggleMessagePin = useCallback(
    async (conversationId: string, messageId: string) => {
      const before = pinnedMessages[conversationId] ?? [];
      const pinned = !before.includes(messageId);
      // Optimistic pin/unpin; the authoritative state comes from the table on
      // the next refresh of the conversation.
      setPinnedMessages((prev) => ({
        ...prev,
        [conversationId]: pinned ? [...before, messageId] : before.filter((id) => id !== messageId),
      }));

      const revert = () =>
        setPinnedMessages((prev) => ({ ...prev, [conversationId]: before }));

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(conversationId) || !isUuid(messageId)) {
        pushToast(pinned ? 'Pinned for this session' : 'Unpinned');
        return;
      }

      if (pinned) {
        const { error } = await supabase.from('pinned_messages').insert({
          conversation_id: conversationId,
          message_id: messageId,
          pinned_by: authUser.id,
        });
        if (error) {
          revert();
          pushToast(friendlyMessagingError(error.message), 'warning');
          return;
        }
        pushToast('Message pinned', 'success');
      } else {
        const { error } = await supabase
          .from('pinned_messages')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('message_id', messageId);
        if (error) {
          revert();
          pushToast(friendlyMessagingError(error.message), 'warning');
          return;
        }
        pushToast('Message unpinned');
      }
    },
    [authUser, pinnedMessages, pushToast],
  );

  const toggleConversationMute = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const muted = !conv?.muted;
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, muted } : c)));
      pushToast(muted ? 'Muted — no notification sounds from this chat' : 'Unmuted');
      await saveConversationSetting(conversationId, { muted });
    },
    [conversations, pushToast, saveConversationSetting],
  );

  const blockPerson = useCallback(
    async (personId: string, name: string) => {
      setBlockedIds((prev) => (prev.includes(personId) ? prev : [...prev, personId]));
      pushToast(`${name} blocked — they can no longer message you`, 'warning');

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(personId)) return;

      const { error } = await supabase.rpc('block_user', { p_blocked_id: personId });
      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        setBlockedIds((prev) => prev.filter((p) => p !== personId));
      }
    },
    [authUser, pushToast],
  );

  const unblockPerson = useCallback(
    async (personId: string) => {
      setBlockedIds((prev) => prev.filter((p) => p !== personId));
      pushToast('Unblocked — they can message you again');

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser || !isUuid(personId)) return;

      const { error } = await supabase.rpc('unblock_user', { p_blocked_id: personId });
      if (error) {
        pushToast(friendlyMessagingError(error.message), 'warning');
        setBlockedIds((prev) => (prev.includes(personId) ? prev : [...prev, personId]));
        return;
      }
      await refreshInbox();
    },
    [authUser, pushToast, refreshInbox],
  );

  const respondIntroduction = useCallback(
    (id: string, response: 'accepted' | 'declined') => {
      const intro = introductions.find((i) => i.id === id);
      if (!intro || intro.status !== 'pending') return;
      setIntroductions((prev) => prev.map((i) => (i.id === id ? { ...i, status: response } : i)));
      if (response === 'accepted') {
        if (isBackendConfigured() && !isUuid(intro.personId)) {
          pushToast(
            'Introductions use demo profiles for now — real introductions arrive in a later phase.',
            'warning',
          );
          return;
        }
        const person = DEMO_PEOPLE.find((p) => p.id === intro.personId);
        startConversation({
          personId: intro.personId,
          title: person?.name ?? 'Campus introduction',
          initialNote: `Introduced by NUBCONNECT — you both said yes. ${
            person ? `Say hi to ${person.name.split(' ')[0]}!` : ''
          }`,
          introductionId: id,
        });
        pushToast('Introduction made — chat opened', 'success');
      } else {
        // Declining is silent: the other student is never notified.
        pushToast('Declined privately — they are not told');
      }
    },
    [introductions, startConversation, pushToast],
  );

  const unreadCount = useMemo(
    () =>
      conversations
        .filter((c) => c.request !== 'incoming' && c.request !== 'declined')
        .filter((c) => !(c.kind === 'direct' && blockedIds.includes(c.participants[0] ?? '')))
        .reduce((sum, c) => sum + c.unread, 0),
    [conversations, blockedIds],
  );

  const addRoomListing = useCallback(
    async (r: Omit<RoomListing, 'id' | 'isDemo' | 'saved'>, files: readonly File[]) => {
      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        if (!user.primaryUniversityId) {
          pushToast('Your account is not linked to a university yet — please contact the office.');
          return null;
        }
        const result = await createRoomListing(supabase, {
          userId: authUser.id,
          universityId: user.primaryUniversityId,
          departmentId: user.departmentId,
          title: r.title,
          area: r.area,
          rent: r.rent,
          advance: r.advance,
          roomType: r.roomType,
          furnished: r.furnished,
          shared: r.shared,
          availableFrom: r.availableFrom,
          amenities: r.amenities,
          utilities: r.utilities,
          houseRules: r.houseRules,
          description: r.description ?? '',
          photos: r.photos.map((photo, index) => ({
            file: files[index]!,
            kind: photo.room,
            caption: photo.caption,
          })),
        });
        if (!result.id) {
          pushToast(result.error ?? 'The room listing could not be published.');
          return null;
        }
        setMyRooms((prev) => [{ ...r, id: result.id!, isDemo: false, saved: false }, ...prev]);
        pushToast('Room listing published', 'success');
        return result.id;
      }

      const id = `my-rm-${Date.now()}`;
      setMyRooms((prev) => [{ ...r, id, isDemo: false, saved: false }, ...prev]);
      pushToast('Room listing published', 'success');
      return id;
    },
    [authUser, pushToast, user.departmentId, user.primaryUniversityId],
  );

  const updateRoomListing = useCallback(
    (id: string, patch: Partial<RoomListing>) => {
      setMyRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [],
  );

  const addProductListing = useCallback(
    async (p: Omit<MarketplaceListing, 'id' | 'isDemo' | 'saved'>, files: readonly File[]) => {
      const supabase = getSupabaseBrowserClient();
      if (supabase && authUser) {
        if (!user.primaryUniversityId) {
          pushToast('Your account is not linked to a university yet — please contact the office.');
          return null;
        }
        const categorySlugs: Record<MarketplaceListing['category'], string> = {
          'Books & Academic': 'books-academic',
          Electronics: 'electronics',
          Computers: 'computers',
          Furniture: 'furniture',
          Clothing: 'clothing',
          Accessories: 'accessories',
          Sports: 'sports',
          'Bicycles & Transport': 'bicycles-transport',
          'Home Items': 'home-items',
          Services: 'services',
          Other: 'other',
        };
        const result = await createMarketplaceListing(supabase, {
          userId: authUser.id,
          universityId: user.primaryUniversityId,
          title: p.title,
          price: p.price,
          categorySlug: categorySlugs[p.category],
          condition: p.condition,
          description: p.description,
          pickupArea: p.pickupArea,
          photos: files,
        });
        if (!result.id) {
          pushToast(result.error ?? 'The marketplace listing could not be published.');
          return null;
        }
        setMyProducts((prev) => [{ ...p, id: result.id!, isDemo: false, saved: false }, ...prev]);
        pushToast('Marketplace listing published', 'success');
        return result.id;
      }

      const id = `my-mk-${Date.now()}`;
      setMyProducts((prev) => [{ ...p, id, isDemo: false, saved: false }, ...prev]);
      pushToast('Marketplace listing published', 'success');
      return id;
    },
    [authUser, pushToast, user.primaryUniversityId],
  );

  const updateProductListing = useCallback(
    (id: string, patch: Partial<MarketplaceListing>) => {
      const previousStatus = myProducts.find((p) => p.id === id)?.status ?? 'Active';
      setMyProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      if (!patch.status || !isBackendConfigured()) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) return;
      void setMarketplaceListingStatus(supabase, id, patch.status).then(({ error }) => {
        if (!error) return;
        setMyProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: previousStatus } : p)),
        );
        pushToast(error || 'The listing status could not be updated.');
      });
    },
    [authUser, myProducts, pushToast],
  );

  /** Optimistically mark one row read, then persist it and roll back on error. */
  const markNotificationRead = useCallback(
    async (id: string): Promise<boolean> => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.read) return true;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !authUser) return true; // clearly-labelled demo state
      const result = await markNotificationReadRow(supabase, { id, userId: authUser.id });
      if (!result.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
        );
        pushToast(result.error ?? 'Could not mark that notification as read.', 'warning');
        return false;
      }
      return true;
    },
    [authUser, notifications, pushToast],
  );

  /** Persist a bulk read for this account only; never claim success on error. */
  const markAllNotificationsRead = useCallback(async (): Promise<boolean> => {
    const unreadIds = new Set(notifications.filter((n) => !n.read).map((n) => n.id));
    if (unreadIds.size === 0) return true;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) return true; // clearly-labelled demo state
    const result = await markAllNotificationsReadRows(supabase, { userId: authUser.id });
    if (!result.ok) {
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.has(n.id) ? { ...n, read: false } : n)),
      );
      pushToast(result.error ?? 'Could not mark notifications as read.', 'warning');
      return false;
    }
    pushToast('All notifications marked read', 'success');
    return true;
  }, [authUser, notifications, pushToast]);

  const finishOnboarding = useCallback(() => {
    setOnboarded(true);
  }, [setOnboarded]);

  const pushRecentSearch = useCallback(
    (q: string) => {
      const t = q.trim();
      if (t.length < 2) return;
      setRecentSearches([t, ...recentSearches.filter((r) => r !== t)].slice(0, 8));
    },
    [recentSearches, setRecentSearches],
  );

  const clearRecentSearches = useCallback(() => setRecentSearches([]), [setRecentSearches]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value: Store = {
    ready,
    user,
    authConfigured,
    authLoading,
    isDemoUser: !authUser,
    signOut,
    refreshProfile,
    adminAccess,
    refreshAdminAccess,
    platformFlags,
    refreshPlatformFlags,
    privacy,
    setPrivacy,
    preferencesLoading,
    preferencesSaving,
    preferencesError,
    retrySavePreferences,
    theme,
    toggleTheme,
    follows,
    toggleFollow,
    isFollowing,
    joinedCircles,
    joinedGroups,
    toggleJoinCircle,
    toggleJoinGroup,
    promotedCircles,
    promoteCircle,
    plans,
    createPlan,
    joinPlan,
    leavePlan,
    planConversationId,
    introductions,
    respondIntroduction,
    clubs,
    clubsLoading,
    clubDirectoryError,
    people,
    peopleLoading,
    circles,
    groups,
    joinedClubs,
    clubApplications,
    managedClubSlugs,
    myClubMemberships: realMemberships,
    membershipCards,
    honours,
    honoursLoading,
    honoursError,
    refreshClubs,
    refreshHonours,
    refreshPeople,
    refreshCommunities,
    refreshNotifications,
    availability,
    activities,
    campusAreas,
    pulseLoading,
    refreshPulse,
    publishMyAvailability,
    clearMyAvailability,
    createActivity,
    joinActivity,
    leaveActivity,
    requestToJoin,
    respondToJoinRequest,
    applyToClub,
    withdrawClubApplication,
    leaveClub,
    reviewClubApplication,
    setClubMemberRole,
    awardClubHonour,
    requestClubVerification,
    saved,
    toggleSavePost,
    toggleSaveRoom,
    toggleSaveProduct,
    pins: validPins,
    setPins,
    resetPins,
    posts,
    addPost,
    refreshFeed,
    react,
    reactToComment,
    toggleContextAction,
    addComment,
    editComment,
    deleteComment,
    hiddenPostIds,
    hidePost,
    mutedAccountIds,
    muteAccount,
    showLessLikeThis,
    reportContent,
    conversations,
    inboxLoading,
    inboxError,
    refreshInbox,
    refreshConversation,
    sendMessage,
    reactToMessage,
    replyTo,
    setReplyTo,
    acceptRequest,
    declineRequest,
    startConversation,
    unreadCount,
    markConversationRead,
    toggleConversationPin,
    toggleConversationMute,
    toggleConversationArchive,
    toggleMessagePin,
    pinnedMessages,
    presenceHidden,
    setPresenceHidden,
    editMessage,
    deleteMessage,
    forwardMessage,
    blockedIds,
    blockPerson,
    unblockPerson,
    myRooms,
    addRoomListing,
    updateRoomListing,
    myProducts,
    addProductListing,
    updateProductListing,
    notifications,
    notificationsLoading,
    notificationsError,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    onboarded,
    finishOnboarding,
    recentSearches,
    pushRecentSearch,
    clearRecentSearches,
    toasts,
    pushToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
