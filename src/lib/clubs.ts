// ============================================================================
// NUBCONNECT — Club Universe data layer (Phase 4).
//
// One honest path for every club surface:
//   • Backend configured → SECURITY DEFINER RPCs in
//     supabase/migrations/008_clubs_recognition.sql. RLS + the RPC checks
//     decide who can apply, approve, award recognition or read a card.
//   • No credentials → the caller keeps the clearly-labelled DEMO dataset.
//
// Nothing here invents a membership, a recognition or a verification level.
// University-level verification is university-only and the database enforces
// that independently of this file.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapOrganizationRow } from './data';
import { DEMO_CLUBS } from './demo/dataset';
import { canManagePage } from './pages';
import type {
  CampusHonourEntry,
  Club,
  ClubVerification,
  HonourCategory,
} from './types';

export interface ClubMembership {
  organizationId: string;
  slug: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'alumni' | string;
  role: string;
  joinedAt: string | null;
  verifyToken: string | null;
  category: string;
  verificationStatus: string;
}

export interface ManagedClub {
  organizationId: string;
  slug: string;
  name: string;
  designation: string;
}

export interface MyClubState {
  memberships: ClubMembership[];
  managed: ManagedClub[];
  error: string | null;
}

export interface ClubRepresentative {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  designation: string;
}

export interface ClubCommitteeRow {
  roleTitle: string;
  memberName: string;
  sessionTerm: string;
  isVerifiedSource: boolean;
  sourceUrl: string | null;
}

export interface ClubHonour {
  id: string;
  personId: string;
  personName: string;
  departmentCode: string;
  category: HonourCategory;
  title: string;
  detail: string;
  points: number;
  semester: string;
  createdAt: string | null;
}

export interface ClubDetail {
  club: Club;
  memberCount: number;
  representatives: ClubRepresentative[];
  committee: ClubCommitteeRow[];
  aliases: string[];
  myMembership: { status: string; role: string } | null;
  isManager: boolean;
  honours: ClubHonour[];
}

export interface ClubApplication {
  membershipId: string;
  userId: string;
  name: string;
  username: string;
  departmentCode: string;
  semester: string;
  motivation: string;
  appliedAt: string | null;
}

export interface ClubMember {
  membershipId: string;
  userId: string;
  name: string;
  username: string;
  departmentCode: string;
  semester: string;
  role: string;
  status: string;
  joinedAt: string | null;
}

export interface ClubAuditEntry {
  id: string;
  action: string;
  detail: string;
  actorName: string;
  createdAt: string | null;
}

export interface ClubVerificationRequest {
  id: string;
  status: string;
  notes: string;
  advisorName: string;
  evidenceUrls: string[];
  createdAt: string | null;
  reviewedAt: string | null;
}

export interface ClubOrganizationDetails {
  shortDescription: string;
  about: string;
  membershipOpen: boolean;
  membershipRequirements: string;
  officialWebsite: string;
  publicContactEmail: string;
}

export interface ClubManageData {
  club: Club;
  details: ClubOrganizationDetails;
  memberCount: number;
  applications: ClubApplication[];
  members: ClubMember[];
  representatives: ClubRepresentative[];
  committee: ClubCommitteeRow[];
  honours: ClubHonour[];
  verificationRequests: ClubVerificationRequest[];
  audit: ClubAuditEntry[];
}

export interface ManagedClubPage {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  verificationStatus: string;
  canManage: boolean;
}

/**
 * Every action advertised by the Control Center is classified here, away from
 * React. `backendSupported` describes the database contract; `available`
 * additionally accounts for the signed-in manager and linked Page.
 */
export type ClubManageActionId =
  | 'reviewApplications'
  | 'setMemberRoles'
  | 'awardHonours'
  | 'requestVerification'
  | 'editClubDetails'
  | 'editLinkedPage'
  | 'publishPagePosts'
  | 'uploadClubMedia'
  | 'inviteMembers'
  | 'removeMembers'
  | 'assignPresident'
  | 'issueVerification'
  | 'editDeletePagePosts'
  | 'createClubEvents'
  | 'manageGallery'
  | 'manageClubChats';

export interface ClubManageAvailabilityContext {
  backendConfigured: boolean;
  isManager: boolean;
  organizationId: string | null;
  linkedPageId: string | null;
  canManageLinkedPage: boolean;
  universityId: string | null;
}

export interface ClubManageActionAvailability {
  id: ClubManageActionId;
  label: string;
  backendSupported: boolean;
  available: boolean;
  /** Null only when the action is currently enabled. */
  reason: string | null;
}

export interface PublicMembershipCard {
  clubSlug: string;
  clubName: string;
  personName: string;
  personDepartment: string;
  role: string;
  since: string;
  status: string;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(asRow) : [];
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

const SUPPORTED_CLUB_MANAGE_ACTIONS: ReadonlyArray<{
  id: ClubManageActionId;
  label: string;
}> = [
  { id: 'reviewApplications', label: 'Review membership applications' },
  { id: 'setMemberRoles', label: 'Assign permitted member roles' },
  { id: 'awardHonours', label: 'Award club-verified Campus Honours' },
  { id: 'requestVerification', label: 'Request a university verification review' },
  { id: 'editClubDetails', label: 'Edit club details and contact information' },
  { id: 'editLinkedPage', label: 'Edit the linked club Page' },
  { id: 'publishPagePosts', label: 'Publish posts as the club Page' },
  { id: 'uploadClubMedia', label: 'Upload club logo and cover image' },
];

const UNSUPPORTED_CLUB_MANAGE_ACTIONS: ReadonlyArray<{
  id: ClubManageActionId;
  label: string;
  reason: string;
}> = [
  {
    id: 'inviteMembers',
    label: 'Invite members',
    reason:
      'Requires backend support: no invitation RPC or safe RLS write path exists for club managers.',
  },
  {
    id: 'removeMembers',
    label: 'Remove another member',
    reason:
      'Requires backend support: organization_members has no manager-scoped delete policy or RPC. Only self-withdrawal is supported.',
  },
  {
    id: 'assignPresident',
    label: 'Assign or hand over president',
    reason:
      'Requires backend support: representative and leadership changes are university-admin-only; no manager RPC exists.',
  },
  {
    id: 'issueVerification',
    label: 'Issue university verification',
    reason:
      'Requires backend support: university verification is granted by the university, never by a club representative. Only a review request can be submitted here.',
  },
  {
    id: 'editDeletePagePosts',
    label: 'Edit, delete or pin any club Page post',
    reason:
      'Requires backend support: Page managers can publish, but there is no manager-scoped edit/delete/pin RPC for another representative’s post.',
  },
  {
    id: 'createClubEvents',
    label: 'Create club events',
    reason:
      'Requires backend support: events have no manager RPC or RLS write policy for clubs.',
  },
  {
    id: 'manageGallery',
    label: 'Manage a club gallery',
    reason:
      'Requires backend support: no club/Page gallery bucket or manager-scoped gallery table is present.',
  },
  {
    id: 'manageClubChats',
    label: 'Manage club-related group chats',
    reason:
      'Requires backend support: no club-scoped conversation creation or management path exists.',
  },
];

function supportedActionBlocker(
  id: ClubManageActionId,
  context: ClubManageAvailabilityContext,
): string | null {
  if (!context.backendConfigured) return 'Connect the Supabase backend to use this action.';
  if (!context.isManager) return 'Only an authorized club representative can use this action.';
  if (!context.organizationId) return 'This club has no database organization ID yet.';

  if (id === 'editLinkedPage' || id === 'publishPagePosts') {
    if (!context.linkedPageId) return 'No linked club Page was found for this organization.';
    if (!context.canManageLinkedPage) return 'You do not have Page manager permission for the linked Page.';
    if (id === 'publishPagePosts' && !context.universityId) {
      return 'Your account is not linked to a university yet.';
    }
  }
  return null;
}

/** Pure map used by the Control Center to separate real actions from requests. */
export function getClubManageActions(
  context: ClubManageAvailabilityContext,
): ClubManageActionAvailability[] {
  const supported = SUPPORTED_CLUB_MANAGE_ACTIONS.map((action) => {
    const reason = supportedActionBlocker(action.id, context);
    return { ...action, backendSupported: true, available: reason === null, reason };
  });
  const unsupported = UNSUPPORTED_CLUB_MANAGE_ACTIONS.map((action) => ({
    ...action,
    backendSupported: false,
    available: false,
  }));
  return [...supported, ...unsupported];
}

function verificationFromLegacy(status: Club['verificationStatus']): ClubVerification {
  const map: Record<Club['verificationStatus'], ClubVerification> = {
    'Officially Verified': 'Officially Verified',
    'Department Verified': 'Department Recognized',
    'Recognized Organization': 'Club Verified',
    'Awaiting Verification': 'Awaiting Verification',
    'Student-Led': 'Student-Led',
  };
  return map[status] ?? 'Student-Led';
}

/** Map a real directory/detail row into the existing Club view model. */
export function mapClubRow(row: Row): Club {
  const base = mapOrganizationRow(row);
  return {
    ...base,
    organizationId: nullableStr(row.id) ?? undefined,
    logoUrl: nullableStr(row.logo_url) ?? undefined,
    coverUrl: nullableStr(row.cover_url) ?? undefined,
    sourceUrl: nullableStr(row.source_url) ?? undefined,
    membershipOpen: row.membership_open === undefined ? true : bool(row.membership_open, true),
    membershipRequirements: nullableStr(row.membership_requirements) ?? undefined,
    isManager: bool(row.is_manager),
    verification: verificationFromLegacy(base.verificationStatus),
    activity: 'Active',
  };
}

function mapMembership(row: Row): ClubMembership {
  return {
    organizationId: str(row.organization_id),
    slug: str(row.slug),
    name: str(row.name),
    status: str(row.status, 'pending'),
    role: str(row.role, 'Member'),
    joinedAt: nullableStr(row.joined_at),
    verifyToken: nullableStr(row.verify_token),
    category: str(row.category, 'Community'),
    verificationStatus: str(row.verification_status, 'awaiting_verification'),
  };
}

function mapManaged(row: Row): ManagedClub {
  return {
    organizationId: str(row.organization_id),
    slug: str(row.slug),
    name: str(row.name),
    designation: str(row.designation, 'Representative'),
  };
}

function mapRepresentative(row: Row): ClubRepresentative {
  return {
    userId: str(row.user_id),
    name: str(row.name, 'Student representative'),
    username: str(row.username),
    avatarUrl: nullableStr(row.avatar_url),
    designation: str(row.designation, 'Representative'),
  };
}

function mapCommittee(row: Row): ClubCommitteeRow {
  return {
    roleTitle: str(row.role_title, 'Committee member'),
    memberName: str(row.member_name, 'Name not published'),
    sessionTerm: str(row.session_term),
    isVerifiedSource: bool(row.is_verified_source),
    sourceUrl: nullableStr(row.source_url),
  };
}

function mapClubHonour(row: Row): ClubHonour {
  return {
    id: str(row.id),
    personId: str(row.person_id),
    personName: str(row.person_name, 'Student'),
    departmentCode: str(row.department_code, 'NUB'),
    category: str(row.category, 'Volunteering') as HonourCategory,
    title: str(row.title),
    detail: str(row.detail),
    points: num(row.points),
    semester: str(row.semester),
    createdAt: nullableStr(row.created_at),
  };
}

function mapApplication(row: Row): ClubApplication {
  return {
    membershipId: str(row.membership_id),
    userId: str(row.user_id),
    name: str(row.name, 'Student'),
    username: str(row.username),
    departmentCode: str(row.department_code, 'NUB'),
    semester: str(row.semester),
    motivation: str(row.motivation),
    appliedAt: nullableStr(row.applied_at),
  };
}

function mapMember(row: Row): ClubMember {
  return {
    membershipId: str(row.membership_id),
    userId: str(row.user_id),
    name: str(row.name, 'Student'),
    username: str(row.username),
    departmentCode: str(row.department_code, 'NUB'),
    semester: str(row.semester),
    role: str(row.role, 'Member'),
    status: str(row.status, 'approved'),
    joinedAt: nullableStr(row.joined_at),
  };
}

function mapAudit(row: Row): ClubAuditEntry {
  return {
    id: str(row.id),
    action: str(row.action),
    detail: str(row.detail),
    actorName: str(row.actor_name, 'System'),
    createdAt: nullableStr(row.created_at),
  };
}

function mapVerificationRequest(row: Row): ClubVerificationRequest {
  return {
    id: str(row.id),
    status: str(row.status, 'pending'),
    notes: str(row.notes),
    advisorName: str(row.advisor_name),
    evidenceUrls: Array.isArray(row.evidence_urls)
      ? row.evidence_urls.filter((u): u is string => typeof u === 'string')
      : [],
    createdAt: nullableStr(row.created_at),
    reviewedAt: nullableStr(row.reviewed_at),
  };
}

/** Turn a Supabase/RPC error into copy a student can act on. */
export function friendlyClubError(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';

  if (!message) return 'Something went wrong. Please try again.';
  if (/jwt|session|refresh token/i.test(message)) {
    return 'Your session expired. Sign in again and retry.';
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'You already have a membership or application for this club.';
  }
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return 'You do not have permission to do that.';
  }
  if (/schema|relation .* does not exist|function .* does not exist/i.test(message)) {
    return 'Club data is not available yet. Ask the administrator to apply the latest database migration.';
  }
  // RPC messages are written for students ("Your application is already
  // pending", "Only club representatives…"), so pass those through.
  if (message.length <= 220 && !/^[A-Z0-9_]+:/.test(message)) return message;
  return 'Something went wrong. Please try again.';
}

/* === Reads ================================================================= */

export async function loadClubDirectory(
  client: SupabaseClient | null,
): Promise<{ clubs: Club[]; error: string | null }> {
  if (!client) return { clubs: DEMO_CLUBS, error: null };

  const { data, error } = await client.rpc('get_clubs_directory');
  if (error) return { clubs: [], error: friendlyClubError(error) };

  const rows = asRows(data);
  return { clubs: rows.map(mapClubRow), error: null };
}

export async function loadMyClubState(
  client: SupabaseClient | null,
): Promise<MyClubState> {
  if (!client) return { memberships: [], managed: [], error: null };

  const { data, error } = await client.rpc('get_my_club_state');
  if (error) return { memberships: [], managed: [], error: friendlyClubError(error) };

  const row = asRow(data);
  return {
    memberships: asRows(row.memberships).map(mapMembership),
    managed: asRows(row.managed).map(mapManaged),
    error: null,
  };
}

export async function loadClubDetail(
  client: SupabaseClient | null,
  slug: string,
): Promise<{ detail: ClubDetail | null; error: string | null }> {
  if (!client) return { detail: null, error: null };

  const { data, error } = await client.rpc('get_club_detail', { p_slug: slug });
  if (error) return { detail: null, error: friendlyClubError(error) };
  if (!data) return { detail: null, error: null };

  const row = asRow(data);
  const clubRow = asRow(row.club);
  const memberCount = num(row.member_count);
  const club = mapClubRow({ ...clubRow, member_count: memberCount });
  const myMembershipRow = row.my_membership ? asRow(row.my_membership) : null;

  return {
    detail: {
      club,
      memberCount,
      representatives: asRows(row.representatives).map(mapRepresentative),
      committee: asRows(row.committee).map(mapCommittee),
      aliases: Array.isArray(row.aliases)
        ? row.aliases.filter((a): a is string => typeof a === 'string')
        : [],
      myMembership: myMembershipRow
        ? {
            status: str(myMembershipRow.status, 'pending'),
            role: str(myMembershipRow.role, 'Member'),
          }
        : null,
      isManager: bool(row.is_manager),
      honours: asRows(row.honours).map(mapClubHonour),
    },
    error: null,
  };
}

export async function loadClubManageData(
  client: SupabaseClient | null,
  organizationId: string,
): Promise<{ data: ClubManageData | null; error: string | null }> {
  if (!client) return { data: null, error: null };

  const { data, error } = await client.rpc('get_club_manage_data', {
    p_org_id: organizationId,
  });
  if (error) return { data: null, error: friendlyClubError(error) };
  if (!data) return { data: null, error: 'Club not found' };

  const row = asRow(data);
  const clubRow = asRow(row.club);
  const memberCount = num(row.member_count);
  return {
    data: {
      club: mapClubRow({ ...clubRow, member_count: memberCount }),
      details: {
        shortDescription: str(clubRow.short_description),
        about: str(clubRow.about),
        membershipOpen: clubRow.membership_open === undefined ? true : bool(clubRow.membership_open, true),
        membershipRequirements: str(clubRow.membership_requirements),
        officialWebsite: str(clubRow.official_website),
        publicContactEmail: str(clubRow.public_contact_email),
      },
      memberCount,
      applications: asRows(row.applications).map(mapApplication),
      members: asRows(row.members).map(mapMember),
      representatives: asRows(row.representatives).map(mapRepresentative),
      committee: asRows(row.committee).map(mapCommittee),
      honours: asRows(row.honours).map(mapClubHonour),
      verificationRequests: asRows(row.verification_requests).map(mapVerificationRequest),
      audit: asRows(row.audit).map(mapAudit),
    },
    error: null,
  };
}

/**
 * Find the active Page linked to an organization. The SELECT is covered by
 * Page RLS; the manager check uses the existing SECURITY DEFINER RPC, so a
 * club cannot edit a Page it does not manage.
 */
export async function loadManagedClubPage(
  client: SupabaseClient | null,
  organizationId: string,
): Promise<{ page: ManagedClubPage | null; error: string | null }> {
  if (!client) return { page: null, error: null };

  const { data, error } = await client
    .from('pages')
    .select(
      'id, slug, name, kind, description, avatar_url, cover_url, verification_status, is_active, organization_id',
    )
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .limit(1);
  if (error) return { page: null, error: friendlyClubError(error) };

  const row = asRows(data)[0];
  if (!row) return { page: null, error: null };
  const pageId = str(row.id);
  if (!pageId) return { page: null, error: null };

  const canManage = await canManagePage(client, pageId);
  return {
    page: {
      id: pageId,
      slug: str(row.slug),
      name: str(row.name, 'Club Page'),
      kind: str(row.kind, 'club'),
      description: nullableStr(row.description),
      avatarUrl: nullableStr(row.avatar_url),
      coverUrl: nullableStr(row.cover_url),
      verificationStatus: str(row.verification_status, 'awaiting_verification'),
      canManage,
    },
    error: null,
  };
}

export interface UpdateClubOrganizationDetailsInput extends ClubOrganizationDetails {
  organizationId: string;
}

export interface UpdateClubOrganizationMediaInput {
  organizationId: string;
  /** Public URL written to organizations.logo_url; omit to leave unchanged. */
  logoUrl?: string | null;
  /** Public URL written to organizations.cover_url; omit to leave unchanged. */
  coverUrl?: string | null;
}

/**
 * Persist the club's logo and/or cover. Uses the same organizations RLS
 * policy as editClubDetails — club reps can change these columns freely but
 * can never touch verification_status, university_id or slug (trigger). The
 * storage write itself goes to the post-media bucket under the uploader's
 * own folder, exactly like post photographs.
 */
export async function updateClubOrganizationMedia(
  client: SupabaseClient,
  input: UpdateClubOrganizationMediaInput,
): Promise<{ error: string | null }> {
  const patch: Record<string, string | null> = {};
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
  if (Object.keys(patch).length === 0) return { error: 'Nothing to update.' };

  const { error } = await client.from('organizations').update(patch).eq('id', input.organizationId);
  return { error: error ? friendlyClubError(error) : null };
}

/** Safe RLS update: club reps may edit details, never verification_status. */
export async function updateClubOrganizationDetails(
  client: SupabaseClient,
  input: UpdateClubOrganizationDetailsInput,
): Promise<{ error: string | null }> {
  const shortDescription = input.shortDescription.trim();
  if (!shortDescription) return { error: 'Add a short description first.' };

  const { error } = await client
    .from('organizations')
    .update({
      short_description: shortDescription,
      about: nullableStr(input.about),
      membership_open: input.membershipOpen,
      membership_requirements: nullableStr(input.membershipRequirements),
      official_website: nullableStr(input.officialWebsite),
      public_contact_email: nullableStr(input.publicContactEmail),
    })
    .eq('id', input.organizationId);
  return { error: error ? friendlyClubError(error) : null };
}

export interface UpdateManagedClubPageInput {
  pageId: string;
  name: string;
  description: string;
}

/** Safe RLS update guarded by can_manage_page; verification is never touched. */
export async function updateManagedClubPage(
  client: SupabaseClient,
  input: UpdateManagedClubPageInput,
): Promise<{ error: string | null }> {
  const name = input.name.trim();
  if (!name) return { error: 'Add a Page name first.' };

  const { error } = await client
    .from('pages')
    .update({ name, description: nullableStr(input.description) })
    .eq('id', input.pageId);
  return { error: error ? friendlyClubError(error) : null };
}

export type ClubPagePostOrigin = 'verified_club' | 'recognized_organization';

/** Origin labels allowed by the posts INSERT policy for a Page publication. */
export function clubPostOrigin(verification: unknown): ClubPagePostOrigin {
  if (verification === 'Officially Verified' || verification === 'Club Verified') {
    return 'verified_club';
  }
  return 'recognized_organization';
}

export interface PublishClubPagePostInput {
  authorId: string;
  universityId: string;
  pageId: string;
  verification: unknown;
  title?: string;
  body: string;
  category?: string;
  /** University-wide is the only visibility this Page publish path targets. */
  visibility?: 'university';
}

/** Publish through posts RLS with a Page the author has already been checked for. */
export async function publishClubPagePost(
  client: SupabaseClient,
  input: PublishClubPagePostInput,
): Promise<{ id: string | null; error: string | null }> {
  const body = input.body.trim();
  if (!body) return { id: null, error: 'Write something first.' };
  if (!input.universityId) {
    return { id: null, error: 'Your account is not linked to a university yet.' };
  }

  const { data, error } = await client
    .from('posts')
    .insert({
      university_id: input.universityId,
      author_id: input.authorId,
      page_id: input.pageId,
      content_origin: clubPostOrigin(input.verification),
      category: input.category?.trim() || 'announcement',
      title: nullableStr(input.title),
      body,
      visibility: input.visibility ?? 'university',
      publication_status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return { id: null, error: friendlyClubError(error) };

  return { id: data && typeof data.id === 'string' ? data.id : null, error: null };
}

export async function loadHonours(
  client: SupabaseClient | null,
  semester?: string,
): Promise<{ honours: CampusHonourEntry[]; error: string | null }> {
  if (!client) return { honours: [], error: null };

  const { data, error } = await client.rpc(
    'get_honours_feed',
    semester ? { p_semester: semester } : {},
  );
  if (error) return { honours: [], error: friendlyClubError(error) };

  return {
    honours: asRows(data).map((row) => ({
      id: str(row.id),
      personId: str(row.person_id),
      personName: str(row.person_name, 'Student'),
      departmentCode: str(row.department_code, 'NUB'),
      category: str(row.category, 'Volunteering') as HonourCategory,
      title: str(row.title),
      detail: str(row.detail),
      points: num(row.points),
      semester: str(row.semester),
      isDemo: false,
    })),
    error: null,
  };
}

/** Public, read-only card lookup. Returns only what is printed on the card. */
export async function loadMembershipCard(
  client: SupabaseClient | null,
  token: string,
): Promise<{ card: PublicMembershipCard | null; error: string | null }> {
  if (!client) return { card: null, error: null };

  const { data, error } = await client.rpc('get_membership_card', { p_token: token });
  if (error) return { card: null, error: friendlyClubError(error) };
  if (!data) return { card: null, error: null };

  const row = asRow(data);
  return {
    card: {
      clubSlug: str(row.club_slug),
      clubName: str(row.club_name),
      personName: str(row.person_name),
      personDepartment: str(row.person_department),
      role: str(row.role, 'Member'),
      since: str(row.since),
      status: str(row.status, 'approved'),
    },
    error: null,
  };
}

/* === Student actions ======================================================= */

export async function applyToOrganization(
  client: SupabaseClient,
  organizationId: string,
  note?: string,
): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await client.rpc('apply_to_organization', {
    p_org_id: organizationId,
    p_note: note?.trim() || null,
  });
  if (error) return { status: null, error: friendlyClubError(error) };
  return { status: typeof data === 'string' ? data : 'pending', error: null };
}

export async function withdrawClubApplication(
  client: SupabaseClient,
  organizationId: string,
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('withdraw_club_application', {
    p_org_id: organizationId,
  });
  return { error: error ? friendlyClubError(error) : null };
}

export async function leaveOrganization(
  client: SupabaseClient,
  organizationId: string,
): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await client.rpc('leave_organization', {
    p_org_id: organizationId,
  });
  if (error) return { status: null, error: friendlyClubError(error) };
  return { status: typeof data === 'string' ? data : 'alumni', error: null };
}

/* === Club manager actions ================================================== */

export async function reviewClubApplication(
  client: SupabaseClient,
  membershipId: string,
  decision: 'approved' | 'rejected' | 'pending',
  role?: string,
  note?: string,
): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await client.rpc('review_club_application', {
    p_membership_id: membershipId,
    p_decision: decision,
    p_role: role?.trim() || null,
    p_note: note?.trim() || null,
  });
  if (error) return { status: null, error: friendlyClubError(error) };
  return { status: typeof data === 'string' ? data : decision, error: null };
}

export async function setClubMemberRole(
  client: SupabaseClient,
  membershipId: string,
  role: string,
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('set_club_member_role', {
    p_membership_id: membershipId,
    p_role: role,
  });
  return { error: error ? friendlyClubError(error) : null };
}

export async function awardClubHonour(
  client: SupabaseClient,
  input: {
    organizationId: string;
    personId: string;
    category: HonourCategory;
    title: string;
    detail?: string;
    points: number;
    semester: string;
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('award_club_honour', {
    p_org_id: input.organizationId,
    p_person_id: input.personId,
    p_category: input.category,
    p_title: input.title,
    p_detail: input.detail?.trim() || null,
    p_points: input.points,
    p_semester: input.semester,
  });
  if (error) return { id: null, error: friendlyClubError(error) };
  return { id: typeof data === 'string' ? data : null, error: null };
}

export async function requestClubVerification(
  client: SupabaseClient,
  organizationId: string,
  notes?: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await client.rpc('request_club_verification', {
    p_org_id: organizationId,
    p_evidence_urls: [],
    p_notes: notes?.trim() || null,
    p_advisor: null,
  });
  if (error) return { id: null, error: friendlyClubError(error) };
  return { id: typeof data === 'string' ? data : null, error: null };
}
