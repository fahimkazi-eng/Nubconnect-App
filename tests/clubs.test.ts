// ============================================================================
// NUBCONNECT — clubs.ts unit tests (Phase 4 / §27)
// Row mapping, honest error copy, action availability and the exact RPC/RLS
// calls used by the club Control Center.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_CLUBS } from '@/lib/demo/dataset';
import {
  awardClubHonour,
  clubPostOrigin,
  friendlyClubError,
  getClubManageActions,
  loadClubDirectory,
  loadClubManageData,
  loadHonours,
  loadManagedClubPage,
  mapClubRow,
  publishClubPagePost,
  requestClubVerification,
  reviewClubApplication,
  setClubMemberRole,
  updateClubOrganizationDetails,
  updateManagedClubPage,
} from '@/lib/clubs';

const ORG = '11111111-1111-4111-8111-111111111111';
const PAGE = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const UNI = '44444444-4444-4444-8444-444444444444';

/** Minimal thenable query builder for asserting table/params without a DB. */
function fakeQuery<T>(data: T, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  const result = { data, error };
  for (const method of ['select', 'eq', 'limit', 'update', 'insert', 'single', 'maybeSingle']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function fakeClient({
  rpc = vi.fn(async () => ({ data: null, error: null })),
  from = vi.fn(() => fakeQuery([])),
}: {
  rpc?: ReturnType<typeof vi.fn>;
  from?: ReturnType<typeof vi.fn>;
} = {}): SupabaseClient {
  return { rpc, from } as unknown as SupabaseClient;
}

const fullContext = {
  backendConfigured: true,
  isManager: true,
  organizationId: ORG,
  linkedPageId: PAGE,
  canManageLinkedPage: true,
  universityId: UNI,
};

describe('club row mapping', () => {
  it('maps a real directory row into the existing Club view model', () => {
    const club = mapClubRow({
      id: ORG,
      slug: 'nubcc',
      name: 'NUB Computer Club (NUBCC)',
      short_description: 'Student-led computing community',
      about: 'A long about section.',
      category: 'Technology',
      scope_type: 'university_wide',
      verification_status: 'officially_verified',
      membership_open: true,
      membership_requirements: 'Open to all NUB students.',
      logo_url: 'https://example.test/logo.png',
      cover_url: 'https://example.test/cover.jpg',
      source_url: 'https://www.nub.ac.bd/clubs',
      member_count: 42,
      is_manager: true,
    });

    expect(club.organizationId).toBe(ORG);
    expect(club.slug).toBe('nubcc');
    expect(club.memberCount).toBe(42);
    expect(club.verificationStatus).toBe('Officially Verified');
    expect(club.verification).toBe('Officially Verified');
    expect(club.membershipOpen).toBe(true);
    expect(club.membershipRequirements).toBe('Open to all NUB students.');
    expect(club.logoUrl).toBe('https://example.test/logo.png');
    expect(club.coverUrl).toBe('https://example.test/cover.jpg');
    expect(club.sourceUrl).toBe('https://www.nub.ac.bd/clubs');
    expect(club.isManager).toBe(true);
    expect(club.isDemo).toBe(false);
  });

  it('keeps the legacy status and maps the richer taxonomy', () => {
    const club = mapClubRow({
      id: ORG,
      slug: 'film-photo',
      name: 'NUB Film & Photography Club',
      category: 'Creative',
      scope_type: 'department_specific',
      verification_status: 'recognized_organization',
      membership_open: false,
      member_count: 0,
    });

    expect(club.scope).toBe('Departmental');
    expect(club.verificationStatus).toBe('Recognized Organization');
    expect(club.verification).toBe('Club Verified');
    expect(club.membershipOpen).toBe(false);
    expect(club.isManager).toBe(false);
  });

  it('does not invent a logo, cover or source when the row omits them', () => {
    const club = mapClubRow({
      id: ORG,
      slug: 'quiet-club',
      name: 'Quiet Club',
      category: 'Community',
      verification_status: 'awaiting_verification',
    });

    expect(club.logoUrl).toBeUndefined();
    expect(club.coverUrl).toBeUndefined();
    expect(club.sourceUrl).toBeUndefined();
    expect(club.membershipRequirements).toBeUndefined();
    expect(club.membershipOpen).toBe(true);
  });
});

describe('demo fallback', () => {
  it('returns the clearly-labelled demo roster only when no backend client exists', async () => {
    const result = await loadClubDirectory(null);
    expect(result.error).toBeNull();
    expect(result.clubs).toHaveLength(DEMO_CLUBS.length);
    expect(result.clubs.every((club) => club.isDemo || !club.organizationId)).toBe(true);
  });

  it('does not invent honours without a backend', async () => {
    const result = await loadHonours(null);
    expect(result.honours).toEqual([]);
    expect(result.error).toBeNull();
  });
});

describe('honest error copy', () => {
  it('translates session, duplicate, permission and migration errors', () => {
    expect(friendlyClubError('JWT expired')).toContain('session expired');
    expect(friendlyClubError('duplicate key value violates unique constraint')).toContain(
      'already have a membership',
    );
    expect(friendlyClubError('new row violates row-level security policy')).toContain(
      'permission',
    );
    expect(friendlyClubError('function public.get_clubs_directory() does not exist')).toContain(
      'latest database migration',
    );
  });

  it('passes student-facing RPC messages through unchanged', () => {
    expect(friendlyClubError('Your application is already pending')).toBe(
      'Your application is already pending',
    );
    expect(friendlyClubError('You cannot award recognition to yourself')).toBe(
      'You cannot award recognition to yourself',
    );
  });

  it('falls back to a calm generic message, never a fake success', () => {
    expect(friendlyClubError(null)).toContain('Something went wrong');
    expect(friendlyClubError('')).toContain('Something went wrong');
    expect(
      friendlyClubError(
        'ERROR: 42501: permission denied for schema public at character 1 with a very long internal stack trace that should never reach a student',
      ),
    ).toContain('permission');
  });
});

describe('control-center action availability', () => {
  it('enables only actions with a real backend path for an authorized manager', () => {
    const actions = getClubManageActions(fullContext);
    const review = actions.find((action) => action.id === 'reviewApplications');
    const publish = actions.find((action) => action.id === 'publishPagePosts');
    const media = actions.find((action) => action.id === 'uploadClubMedia');
    const issue = actions.find((action) => action.id === 'issueVerification');

    expect(review).toMatchObject({ backendSupported: true, available: true, reason: null });
    expect(publish).toMatchObject({ backendSupported: true, available: true, reason: null });
    expect(media).toMatchObject({ backendSupported: true, available: true, reason: null });
    expect(issue).toMatchObject({ backendSupported: false, available: false });
  });

  it('gives every unsupported action a concrete Requires backend support reason', () => {
    const unsupported = getClubManageActions(fullContext).filter(
      (action) => !action.backendSupported,
    );

    expect(unsupported.length).toBeGreaterThan(0);
    expect(unsupported.map((action) => action.id)).toEqual(
      expect.arrayContaining([
        'inviteMembers',
        'removeMembers',
        'assignPresident',
        'issueVerification',
        'createClubEvents',
      ]),
    );
    expect(
      unsupported.every(
        (action) => !action.available && action.reason?.startsWith('Requires backend support:'),
      ),
    ).toBe(true);
  });

  it('keeps supported actions honest when the Page or manager context is missing', () => {
    const withoutPage = getClubManageActions({
      ...fullContext,
      linkedPageId: null,
      canManageLinkedPage: false,
      universityId: null,
    });
    const publish = withoutPage.find((action) => action.id === 'publishPagePosts');
    expect(publish?.backendSupported).toBe(true);
    expect(publish?.available).toBe(false);
    expect(publish?.reason).toContain('linked club Page');

    const nonManager = getClubManageActions({ ...fullContext, isManager: false });
    expect(nonManager.find((action) => action.id === 'reviewApplications')?.available).toBe(false);
    expect(nonManager.find((action) => action.id === 'reviewApplications')?.reason).toContain(
      'authorized club representative',
    );
  });
});

describe('club manager RPC names and params', () => {
  it('loads manage data with the organization id only', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        club: {
          id: ORG,
          slug: 'nubcc',
          name: 'NUB Computer Club',
          category: 'Technology',
          short_description: 'Computing community',
          about: 'For students.',
          membership_open: true,
          membership_requirements: 'Open to all.',
          official_website: 'https://club.test',
          public_contact_email: 'club@test.example',
        },
        member_count: 3,
      },
      error: null,
    }));
    const result = await loadClubManageData(fakeClient({ rpc }), ORG);

    expect(rpc).toHaveBeenCalledWith('get_club_manage_data', { p_org_id: ORG });
    expect(result.data?.details.shortDescription).toBe('Computing community');
    expect(result.data?.details.publicContactEmail).toBe('club@test.example');
  });

  it('calls every audited manager RPC with the exact documented params', async () => {
    const rpc = vi.fn(async () => ({ data: 'ok', error: null }));
    const client = fakeClient({ rpc });

    await reviewClubApplication(client, 'membership-1', 'approved', ' Vice President ', ' note ');
    await setClubMemberRole(client, 'membership-2', 'Treasurer');
    await awardClubHonour(client, {
      organizationId: ORG,
      personId: USER,
      category: 'Mentoring',
      title: 'Helped juniors',
      detail: 'Weekly sessions',
      points: 20,
      semester: 'Fall 2026',
    });
    await requestClubVerification(client, ORG, 'Updated advisor');

    expect(rpc).toHaveBeenNthCalledWith(1, 'review_club_application', {
      p_membership_id: 'membership-1',
      p_decision: 'approved',
      p_role: 'Vice President',
      p_note: 'note',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_club_member_role', {
      p_membership_id: 'membership-2',
      p_role: 'Treasurer',
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'award_club_honour', {
      p_org_id: ORG,
      p_person_id: USER,
      p_category: 'Mentoring',
      p_title: 'Helped juniors',
      p_detail: 'Weekly sessions',
      p_points: 20,
      p_semester: 'Fall 2026',
    });
    expect(rpc).toHaveBeenNthCalledWith(4, 'request_club_verification', {
      p_org_id: ORG,
      p_evidence_urls: [],
      p_notes: 'Updated advisor',
      p_advisor: null,
    });
  });

  it('checks Page management with can_manage_page before returning a linked Page', async () => {
    const rpc = vi.fn(async (name: string) =>
      name === 'can_manage_page' ? { data: true, error: null } : { data: null, error: null },
    );
    const from = vi.fn(() =>
      fakeQuery([
        {
          id: PAGE,
          slug: 'nubcc',
          name: 'NUB Computer Club',
          kind: 'club',
          description: 'Official club Page',
          avatar_url: null,
          cover_url: null,
          verification_status: 'awaiting_verification',
        },
      ]),
    );

    const result = await loadManagedClubPage(fakeClient({ rpc, from }), ORG);

    expect(from).toHaveBeenCalledWith('pages');
    expect(rpc).toHaveBeenCalledWith('can_manage_page', { target_page: PAGE });
    expect(result.page).toMatchObject({ id: PAGE, canManage: true });
  });
});

describe('safe RLS writes', () => {
  it('updates allowed organization fields without touching verification', async () => {
    const query = fakeQuery(null);
    const from = vi.fn(() => query);
    const result = await updateClubOrganizationDetails(fakeClient({ from }), {
      organizationId: ORG,
      shortDescription: 'Student-led computing community',
      about: 'Updated about.',
      membershipOpen: false,
      membershipRequirements: 'Open to all.',
      officialWebsite: 'https://club.test',
      publicContactEmail: 'club@test.example',
    });

    const payload = (query.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(from).toHaveBeenCalledWith('organizations');
    expect(payload).toMatchObject({
      short_description: 'Student-led computing community',
      about: 'Updated about.',
      membership_open: false,
      membership_requirements: 'Open to all.',
      official_website: 'https://club.test',
      public_contact_email: 'club@test.example',
    });
    expect(payload).not.toHaveProperty('verification_status');
    expect(query.eq).toHaveBeenCalledWith('id', ORG);
    expect(result.error).toBeNull();
  });

  it('updates only editable Page fields', async () => {
    const query = fakeQuery(null);
    const from = vi.fn(() => query);
    await updateManagedClubPage(fakeClient({ from }), {
      pageId: PAGE,
      name: 'NUB Computer Club',
      description: 'Official club Page',
    });

    const payload = (query.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(from).toHaveBeenCalledWith('pages');
    expect(payload).toEqual({ name: 'NUB Computer Club', description: 'Official club Page' });
    expect(payload).not.toHaveProperty('verification_status');
    expect(query.eq).toHaveBeenCalledWith('id', PAGE);
  });

  it('publishes a Page post with an allowed club content origin', async () => {
    expect(clubPostOrigin('Officially Verified')).toBe('verified_club');
    expect(clubPostOrigin('Club Verified')).toBe('verified_club');
    expect(clubPostOrigin('Awaiting Verification')).toBe('recognized_organization');

    const query = fakeQuery({ id: 'post-1' });
    const from = vi.fn(() => query);
    const result = await publishClubPagePost(fakeClient({ from }), {
      authorId: USER,
      universityId: UNI,
      pageId: PAGE,
      verification: 'Officially Verified',
      title: 'Weekly lab',
      body: 'Open practice session.',
      category: 'activity',
      visibility: 'university',
    });

    const payload = (query.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(from).toHaveBeenCalledWith('posts');
    expect(payload).toMatchObject({
      university_id: UNI,
      author_id: USER,
      page_id: PAGE,
      content_origin: 'verified_club',
      title: 'Weekly lab',
      body: 'Open practice session.',
      category: 'activity',
      visibility: 'university',
      publication_status: 'published',
    });
    expect(payload).not.toHaveProperty('organization_id');
    expect(result.id).toBe('post-1');
    expect(result.error).toBeNull();
  });
});
