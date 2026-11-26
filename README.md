# NUBCONNECT — The Social Campus of Northern University Bangladesh

**Meet people. Find your circle. Live your campus.**

NUBCONNECT is a mobile-first social platform for NUB students: a real feed, circles and clubs, consent-based messaging, roommate discovery with privacy guarantees, and a student marketplace — all photo-only, all labelled honestly.

- **Initial university launch:** Northern University Bangladesh ([nub.ac.bd](https://www.nub.ac.bd/))
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS + Storage) · Vitest
- **Design system:** CAMPUS GLASS — glass chrome, solid content surfaces, mobile-first

> **Disclaimer:** NUBCONNECT distinguishes official university notices from student-created content and does not present itself as an official university-owned ERP unless formal institutional authorization is granted. All GPA/CGPA results are **Unofficial Student Estimates** on the verified NUB 4.00 scale.

---

## The six primary destinations

| Destination | Route | What it is |
| --- | --- | --- |
| **Home** | `/home` | Social feed: Highlights, People You May Know, composer, For You / Following / Campus / My Circles tabs |
| **Department** | `/department` | Department communities first (students, clubs, discussions), academic context second |
| **Find Your Circle** | `/circle` | People, Circles, Clubs and Groups with filters and detail pages |
| **Messages** | `/messages` | Inbox + full-screen chat; consent-based requests, reactions, replies, photo attachments |
| **Academic** | `/academic` | NUB 4.00 GPA/CGPA calculators, Bi/Tri-semester calendar, study groups |
| **Find Roommates** | `/roommates` | Room listings with photo tours by room kind, private enquiries, general areas only |

Secondary destinations live behind **My Pins** (pin, reorder, reset): Marketplace, Events, Opportunities, Lost & Found, Campus Services, Saved, Notifications, Settings and global Search (`Ctrl+K`).

## Core product principles

- **Follow / Join / Message stay distinct** — no Facebook-style friend requests, ever.
- **Photo-only release** — no video and no video-upload controls anywhere.
- **Roommate privacy** — exact addresses and phone numbers are never public. Listings show general areas; contact happens through private platform enquiries (`src/lib/privacy.ts`).
- **Honest demo mode** — without Supabase credentials the app renders a clearly-labelled DEMO dataset (`src/lib/demo/dataset.ts`) so the product is explorable offline. **The DEMO dataset is a development fixture: with a backend connected the application never falls back to it.** Every surface reads the database, and an empty table produces an honest empty state instead of sample students, posts, listings or conversations.
- **Mobile-first** — 44px touch targets, safe-area-aware navigation, no horizontal overflow from 320px up, keyboard-safe chat composer.
- **Accessibility** — WCAG 2.2 AA aim: semantic landmarks, aria labels, `prefers-reduced-motion` respected, light + intentional dark mode.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — without it the app runs in demo mode
npm run dev                 # http://localhost:3000
```

Environment variables (all optional for demo mode):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_DEFAULT_UNIVERSITY_SLUG` | Tenant slug (defaults to NUB) |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | `true` shows Google sign-in **only after** the provider is enabled in Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service key (never exposed to the client) |

### Database

Run the migrations in order against Supabase (SQL Editor or `supabase db push`):

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/seed/seed_nub.sql`
4. `supabase/migrations/003_social_experience.sql` — community groups, marketplace, room listings, user pins
5. `supabase/migrations/004_campus_orbit.sql` — plans, Campus Now, introductions, club universe
6. `supabase/migrations/005_campus_pulse.sql` — comment reactions + “open to connect”
7. `supabase/migrations/006_student_accounts.sql` — **student accounts**: privacy-aware profile RLS, anti-privilege-escalation trigger, new-user profile/preferences trigger, `avatars`/`covers` storage buckets, verification-request policy
8. `supabase/migrations/007_messaging.sql` — **real 1:1 messaging**: conversation kind/context/request state, message replies and photos, message reactions, per-user pin/mute settings, consent RPCs, read receipts, blocking, inbox RPC and the private `message-photos` bucket
9. `supabase/migrations/008_clubs_recognition.sql` — **real clubs & recognition**: membership application/approval lifecycle, club representative management, audited Control Center actions, public membership-card verification, Campus Honours awarded by clubs/university, and RLS/triggers that keep university-level verification university-only
10. `supabase/migrations/009_auth_user_defaults.sql` — **auth row hardening**: normalises NULL token columns on `auth.users` and gives them the defaults GoTrue expects, so an account created outside the sign-up flow can still sign in
11. `supabase/migrations/010_real_feed.sql` — **real social feed**: post/comment/reaction/follow RLS, the `post-media` bucket, database-computed reaction counts and follower/author notifications
12. `supabase/migrations/011_pages_and_provenance.sql` — **Pages and launch provenance**: the official platform Page, Page membership and permissions, Page-authored posts, and the source/rights/review trail every launch post carries
13. `supabase/migrations/012_campus_pulse.sql` - **Campus Pulse 2.0**: opt-in availability with an explicit on-campus check-in, self-expiring statuses, joinable activities with host-approved requests, campus areas/categories, and realtime publication for the pulse tables
14. `supabase/migrations/013_admin_command_centre.sql` - **Admin command centre**: operational roles (`super_admin`, `admin`, `moderator`, `department_admin`, `club_admin`, `support_admin`) layered on the legacy `app_role_enum` grants, audited RPCs for verification/suspension/role changes, launch-content moderation (archive/restore), report resolution, Campus Pulse monitoring, feature flags (`campus_pulse`, `marketplace`, `roommates`, `stories`) and platform announcements, plus a real-dashboard `admin_dashboard()` with honest gaps marked unavailable. `admin_audit_logs` is append-only by trigger; no privileged write is exposed without server-side authorization.
15. `supabase/migrations/014_admin_permission_fix.sql` - **permission coherence**: makes `users.view` available to the same verification staff (`department_admin`, `support_admin`) who already hold `users.verify`, so they can find the account they are reviewing. No data changes and no new roles.
14. `supabase/seed/launch_content.sql` — **launch content**: 13 departments, 27 clubs from the Student Affairs roster, 12 events from the published nub.ac.bd feed, and 34 launch posts published by the NUB Connect Page

> **One-shot bundle.** `supabase/apply_all.sql` contains every migration plus the
> verified seed in dependency order, for pasting into the Supabase SQL editor on a
> fresh project. It is generated — never edit it by hand; rebuild it with
> `node scripts/build-apply-all.mjs` after changing any migration.

### Student accounts

When Supabase is configured, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` and `/auth/verify-email` are real. Sessions are refreshed in middleware and protected app routes require a signed-in student. Without credentials every auth screen shows an honest **configuration-required** panel — never a fake login form.

- **Account ≠ NUB Verified.** Signing up creates a profile with `is_verified_student = FALSE`. Students may request review from **Settings → Edit profile**; only university staff can approve it.
- Profile photos and covers upload to the public `avatars` / `covers` buckets under `<uid>/…`; RLS confines writes to the owner.
- Privacy choices sync to `user_preferences`; in demo mode they stay on the device.
- Google sign-in is hidden unless `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` **and** the provider is configured in Supabase.
- In Supabase → **Authentication → URL Configuration**, add your site origin and `…/auth/callback` (plus `…/auth/reset-password`) to the allowed redirect URLs. Verification and recovery links otherwise cannot return to the app.
- **The built-in mailer is rate-limited.** Supabase's shared SMTP allows only a handful of confirmation emails per hour, so a sign-up can fail with `over_email_send_rate_limit`. For a campus launch, either turn off "Confirm email" (NUB Verified stays a separate staff review) or connect a custom SMTP provider.
- **QA accounts.** When the mailer is unavailable, create a sign-in-capable test student with `supabase/qa/create_test_user.sql` instead of inserting into `auth.users` by hand. GoTrue scans most token columns as plain strings, so a row with NULLs in them fails every sign-in with `Database error querying schema` (see Troubleshooting).

### Messaging (Phase 3)

With a backend configured, 1:1 conversations are real Supabase rows — never browser-only mocks:

- **Consent first.** `start_conversation` creates an active chat only when the recipient allows direct messages from same-university students; otherwise it creates a pending request that the recipient must accept. Declining removes the conversation from the inbox. Blocking is persisted and enforced in both directions.
- **Private photos.** Attachments upload to the private `message-photos` bucket at `<conversation_id>/<user_id>/<file>`. Only the two participants can read, upload or delete; the app resolves short-lived signed URLs.
- **Read receipts, reactions, replies, pin and mute** are stored per user (`messages.is_read`, `message_reactions`, `conversation_settings`).
- **Inbox.** `get_inbox()` returns the signed-in student's conversations with the other student, last message, unread count and settings in one round trip. The **New** button searches real profiles (privacy-aware RLS) and starts a conversation.
- **Honest boundaries.** Group and plan chats remain **local to the current browser session** and carry that label until group messaging ships. In backend mode, demo profile ids (for example `p-arif`) are rejected rather than turned into fake real conversations. With a backend configured, every surface reads real rows or shows an honest empty state; the demo dataset is used only when no backend is configured.
- Applying `007_messaging.sql` is required before real messaging works. It creates the private bucket, RPCs and policies; no production rows are deleted.

### Clubs & recognition (Phase 4)

With a backend configured, the Club Universe is real data — not a roster mock:

- **Membership lifecycle.** Students apply from a club page (`apply_to_organization`), can withdraw a pending application, and can leave an approved club. Club representatives accept, hold or reject applications from the club **Control Center**. Every action is recorded in `organization_activity_log`.
- **Representative management.** Representatives can review applications, set a member's role, award recognition and request university verification for their own club. A representative can never award recognition to themselves, and can never grant or change university-level verification — a database trigger enforces that even if a policy is misconfigured.
- **Membership cards.** Approved members get a card on their **Passport**. The QR opens the public `/verify/[token]` page, which calls the read-only `get_membership_card` RPC and reveals only the fields printed on the card (club, name, department, role, member since). Revoked or ended memberships stop resolving. A card with no issued token shows "verification pending" rather than a fake QR.
- **Campus Honours.** Club representatives and university admins award recognition in the six transparent categories. The feed is university-scoped, and students who opt out (`show_in_honours = FALSE`) disappear from the honours feed, club pages and the Top Campus Contributor. There is no follower/like ranking and no self-award.
- **Honest boundaries.** `organization_members` was deny-all in migration 002; `008_clubs_recognition.sql` adds the missing policies and audited RPCs. With a backend configured the directory is real (an honest empty state if none exists); the labelled demo clubs appear only when no backend is configured. Signed-out visitors are sent to sign-in for protected areas rather than shown a demo identity. Circle, plan and event stamps on the Passport remain demo data only in the unconfigured build.
- Applying `008_clubs_recognition.sql` is required before real clubs and honours work. It is additive and does not delete existing rows.

### Social feed (Phase 5)

With a backend configured, the Home feed is real data — not a mock:

- **Real posts.** A student publishes text and photographs from the composer. The post is a row in `posts`, the photographs are rows in `post_media` backed by the private-by-owner `post-media` bucket, and the card renders from a single joined read of post, author, photographs and comments.
- **Visibility is enforced in the database.** `post_is_visible()` decides who may read a post: your university, your department, or the communities you have joined. A student cannot post as somebody else, and cannot label a post as official university content — the INSERT policy pins `content_origin` to `student_created`.
- **Reactions and comments are real.** Reactions are stored per student (`reactions`), comments per student (`comments`), and the count of each reaction is computed by `get_post_reaction_counts()` so that nobody can read *who* reacted to what — only how many.
- **Follows are real.** Following a student writes to `follows`, so the Following feed and the follower notifications survive a new device.
- **Notifications are written by the database.** A new post reaches its author's followers; a comment or a reaction reaches the post's author. The app cannot forge one.
- **Honest boundaries.** `posts` had RLS enabled but no policies at all (migration 002), and `post_media` had RLS disabled, so every row was readable and writable by the anon key. `010_real_feed.sql` gives posts their policies, enables RLS on `post_media`, and adds the missing comment policy. With a backend configured the feed is real; an empty feed shows an honest empty state, never the demo dataset. The demo feed is used only when no backend is configured.
- Applying `010_real_feed.sql` is required before the real feed works. It is additive and deletes nothing.

### Media storage (PART 14)

The app now has one storage abstraction for every upload surface. **Supabase Storage remains the default**; Cloudflare R2 is used only when all of its server-side credentials are present.

- **Policy.** `src/lib/storage/provider.ts` is pure and unit-tested. It defines each media kind’s allowed MIME types, byte limit, visibility, key prefix and Supabase bucket, then validates names/sizes, derives the extension from the MIME type (never from the user’s file name), rejects traversal/control characters, and builds `<prefix>/<owner>/<yyyy>/<mm>/<randomId>-<safeName>` keys.
- **Rules.** Avatars are JPEG/PNG/WebP up to 5 MB; covers up to 8 MB; posts and stories up to 10 MB; community/event photos up to 8 MB; room and marketplace photos up to 10 MB; message photos up to 8 MB; documents are PDF/JPEG/PNG up to 20 MB. Message photos and documents are **private** and only resolve through short-lived signed URLs. Room, marketplace and document uploads require a NUB Verified student with a linked university.
- **Upload authorization.** `POST /api/storage/upload-url` requires the request’s Supabase session, loads the caller’s profile, applies the kind’s university/verification rule, re-validates the file server-side, and returns a temporary `uploadUrl` plus the generated `key`. R2 presigned PUTs expire in 5 minutes and sign content type, length and cache policy; Supabase signed uploads use `createSignedUploadUrl` (2-hour token) and also return its `token`/`storagePath`.
- **Deletion + private reads.** `DELETE /api/storage/object` accepts at most 20 `{ kind, keys }` and refuses the whole batch unless every key matches `isOwnedKey(kind, caller, key)`. `GET /api/storage/object?kind=…&key=…` returns a public CDN URL or a 10-minute signed private URL for the owner. Conversation recipients still resolve message photos through the participant-checked messaging RPC/policies, not through bare key ownership.
- **Orphans.** `deleteOrphanedR2Objects()` only deletes `orphan/…` keys, or an explicit key list when a trusted cleanup job passes `allowExplicitKeys` (and optionally `ownerId`). It is not exposed as an HTTP route.
- **Caching.** Public keys are immutable (`public, max-age=31536000, immutable`); private URLs are `no-store`. The API responses themselves are `Cache-Control: no-store`.
- **Secrets.** R2 keys are read only in `src/lib/storage/r2.ts` (`import 'server-only'`), never with a `NEXT_PUBLIC_` prefix. The Supabase service-role key is not used by these routes; authorization runs on the student’s cookie session.
- **Configuration.** Copy the optional block from `.env.example`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and optionally `R2_PUBLIC_BASE_URL`. Leave them unset to stay on Supabase Storage. Existing buckets (`avatars`, `covers`, `post-media`, private `message-photos`) work unchanged; new kinds need their named bucket and an owner-folder policy before their uploads succeed. The R2 bucket's CORS rules must allow `PUT` from the app origin with `Content-Type` and `Cache-Control` headers; Supabase buckets should keep `allowed_mime_types` and `file_size_limit` set (the existing avatar and post buckets already do). The UI upload flows are intentionally not switched to the new route yet.

### Pages and launch content

A **Page** is an organisational identity that publishes on its own behalf, so an official announcement never appears to come from a random student profile.

- **The official NUB Connect Page.** Created by migration 011 and bound to an account whose password is random and unpublished, so no student can impersonate the platform. It publishes through `/page/nub-connect`.
- **Page permissions.** `can_manage_page()` is the single check: a Page owner, its admins and editors, and platform administrators. The post INSERT policy pins a Page post's origin to what that kind of Page may publish, so a student post can never be promoted to official content.
- **Launch content is attributable.** Every launch post records its source URL, source organisation, original publication date, image source, content rights, internal reviewer, publication status, seed batch and whether it may be retired. That is how the owner can remove the launch set later without touching genuine student contributions.
- **The launch set is real.** 13 departments, 27 clubs from the NUB Student Affairs roster, 12 events from the published nub.ac.bd feed, and 34 posts published by the NUB Connect Page — official event announcements, campus photographs from the NUB gallery, department and club spotlights, and the platform's own editorial posts.
- **What is deliberately *not* seeded.** Committee rosters, member counts and club galleries were demonstration records built around invented people. They are not published, because a club page must not show students who do not exist.

### Campus Pulse

**Campus Pulse** (`/pulse`, plus the Home and Circle strips) answers one question honestly: *who has chosen, right now, to be findable — and what are people planning?*

- **Presence is opt-in, never inferred.** Sharing availability writes a row in `campus_now_statuses`. Being signed in, opening the app, or joining a university **never** marks a student as on campus. "I'm physically on campus" is a separate switch the student controls, and the area is a general place (or a free-text line while `pulse_campus_areas` is empty) — never a GPS coordinate.
- **Everything expires.** A status carries `expires_at` (30 minutes to 4 hours) and disappears when it lapses; `expire_stale_availability()` cleans up server-side. Students can take their status down at any moment.
- **Visibility is enforced in the database.** `can_see_availability()` limits reads to the intended audience (`university`, `verified_only`, `circles`, `private`). A student can only insert, update or delete their own row.
- **Activities are real plans.** `activity_plans` carries a description, category, meeting area, participant limit (2–20) and a joining rule: `open` (first come) or `request` (host approves). Counts shown are participants who actually joined — nothing is padded.
- **Join requests are decided server-side.** `join_activity()` refuses a request-only activity; `decide_activity_request()` checks the caller hosts the plan, then updates the request and adds the participant atomically (a host cannot insert another student's participant row directly under RLS).
- **Realtime, without polling.** The four pulse tables are in the `supabase_realtime` publication; `subscribeToPulse()` refreshes the view when someone publishes, joins or leaves.
- **Honest empties.** When nobody has opted in, the page says so and invites the student to be first. There is no manufactured presence, no fabricated "N students nearby", and no history.
- **Administrators can define the campus map.** `pulse_campus_areas` and `pulse_activity_categories` are deliberately empty in the seed — no invented campus map — and the composer falls back to a general free-text area until real areas are added.
- **Shared vocabulary.** Status keys, intentions, categories and expiry choices live in `src/lib/pulse.ts`; legacy rows without a `status_key` map to the neutral *Shared availability* label, which never implies a check-in.

Applying `012_campus_pulse.sql` is required before Campus Pulse works. It is additive (plus widening two stale `CHECK` constraints) and deletes nothing.

### Tests

```bash
npm test        # vitest — unit tests (337 currently, across 21 files)
npm run build   # production build
```

`scripts/pulse-e2e.cjs` exercises the live Campus Pulse data path as a QA student (set `NUB_QA_EMAIL` / `NUB_QA_PASSWORD`) — publish → read with profile joins → create activity → join rules → roster → cleanup — and removes everything it created.

Coverage: the verified NUB grade scale and GPA/CGPA math, Bi/Tri-semester split, roommate privacy helpers (phone masking, general-area-only listings, publishable-listing guard), feed tab logic and ranking, pagination, formatting helpers, student-account preference mapping, messaging row/consent mapping, and club row/error mapping.

### Admin command centre

Migration `013_admin_command_centre.sql` builds the PART 13/28 admin surface on the same Supabase database as the student app — no second backend, no frontend-only "admin" buttons.

- **Roles.** Six operational roles (`super_admin`, `admin`, `moderator`, `department_admin`, `club_admin`, `support_admin`) in `admin_roles`, layered on top of the existing `app_role_enum` grants so legacy `platform_super_admin` / `university_admin` rows keep working. `admin_my_access()` returns what the caller actually holds.
- **Dashboard.** `admin_dashboard()` returns real aggregates only — registered/verified/suspended students, posts, comments, clubs, events, marketplace and room listings, launch posts, Campus Pulse activity, pending reports and verifications, storage bytes. Metrics that aren't collected (engagement rate, failed uploads, precise location) are listed under `unavailable` rather than invented.
- **People.** Verified-student approval/rejection, suspension/restore, and role assignment/revocation all go through audited SECURITY DEFINER RPCs; a student cannot escalate themselves.
- **Launch content.** `admin_list_launch_content()` lists seed posts with batch, source, reviewer and removal eligibility; `admin_moderate_post()` archives/hides/restores with a reason. Archive requires `removal_eligible` (or Super Admin).
- **Reports & Campus Pulse.** List and resolve/dismiss reports; `pulse.monitor` surfaces reported activities and current availability counts.
- **Feature flags & announcements.** `campus_pulse`, `marketplace`, `roommates`, `stories` and a platform announcement live in `system_settings`, toggled only by Super Admin via `admin_set_feature()`/`admin_set_announcement()` and read back by the app through `platform_flags()`.
- **Audit.** Every sensitive action writes `admin_audit_logs` (actor, role, action, table, record, reason, diff). The table is append-only by trigger — UPDATE/DELETE is rejected even from the app.

The app gates the admin UI behind `admin_my_access()`; hiding a button is never the security boundary.

**Where it lives in the app.** `/admin` is a single responsive command centre inside the normal shell, with sections for Overview, People, Launch content, Reports, Features and the Audit trail. A section only appears when the signed-in account holds its permission, and every action opens a reason dialog before it calls the RPC — the reason is what the audit trail stores. More shows an **Administration** link only to real administrators. The UI reads access once per identity change and again on **Refresh access**, so a revoked role disappears without a re-login.

**Enforced switches.** The student app reads `platform_flags()` into the store and honours the result: `campus_pulse` hides the Home and Circle pulse strips and replaces `/pulse` with an honest paused notice, `marketplace` and `roommates` show a closed notice instead of their listings, and a platform announcement renders as a banner above the page. Turning a switch off never deletes content.

A count the database cannot measure (storage bytes, 30-day activity, unconfirmed signups) is returned as `null` and rendered as **Not measured**; it is never shown as `0`.

## Architecture

```
src/
  app/
    (shell)/          # pages inside the app shell (nav, pins, onboarding)
    (chat)/messages/  # full-screen chat — intentionally outside the shell
  components/
    shell/            # AppShell: sidebar + bottom nav + More sheet + onboarding
    feed/  rooms/  marketplace/  circle/  ui/ (kit.tsx primitives)
  lib/
    store.tsx         # client state: follows, joins, saves, pins, posts,
                      # conversations, notifications, toasts (localStorage)
    data.ts           # Supabase table mappers (demo fallback only without a backend)
    academic.ts       # NUB 4.00 scale, GPA/CGPA (pure, unit-tested)
    privacy.ts        # roommate privacy contract (pure, unit-tested)
    feed.ts           # feed tabs + ranking (pure, unit-tested)
    posts.ts          # real posts, photographs, reactions, comments, follows
    pages.ts          # Page identities, Page publishing, Page follows
    people.ts         # the real people directory (privacy-aware)
    notifications.ts  # the notification centre (database-written rows)
    messaging.ts      # real conversation/message rows, inbox, blocks, photos (pure + Supabase)
    clubs.ts          # real club directory/detail, memberships, honours, cards (pure + Supabase)
    demo/dataset.ts   # the DEMO dataset — a development fixture, never production
public/
  manifest.webmanifest, icon.svg, icon-192/512.png, apple-touch-icon.png
  sw.js, offline.html # offline fallback — never caches private data
legacy/
  nubconnect.html     # the original single-file prototype (reference)
```

## Multi-tenant foundations

The schema isolates every student record by `university_id`; RLS policies cover posts, roommate listings, marketplace items, groups and pins. Onboarding another university means inserting tenant rows (`universities`, `university_domains`, `faculties`, `departments` with `semester_system`, `academic_rules`) — no code changes.

## Features requiring institutional authorization

- **ERP grade sync** — the calculator uses the verified NUB 4.00 scale only; transcript import needs NUB IT authorization.
- **Automated directory lookup / SSO** — email verification and invitation codes are supported; real-time enrollment checks need Registrar API access.
- **Full club roster confirmation** — unconfirmed organizations stay labelled `Awaiting Verification` / `Recognized Organization` until Student Affairs sign-off.

## Photos & attribution

Original scene art in `src/lib/photos.ts` is generated deterministically (no external calls). The two real campus photographs in `public/demo/` are documented in `public/demo/ATTRIBUTION.md`.

## Troubleshooting

- **Sign-in fails with `Database error querying schema` (HTTP 500)** — the account row in `auth.users` holds NULLs in columns GoTrue scans as plain strings (`confirmation_token`, `recovery_token`, `email_change`, `raw_user_meta_data`, …), so GoTrue cannot read the row back. Apply `supabase/migrations/009_auth_user_defaults.sql` to normalise it, and create future QA accounts with `supabase/qa/create_test_user.sql`.
- **Sign-up returns `over_email_send_rate_limit`** — Supabase's shared SMTP is rate-limited. Turn off "Confirm email" in Authentication → Sign In / Providers → Email, or connect a custom SMTP provider.
- **`must be owner of table users`** — `auth.users` is owned by Supabase Auth. Run owner-only statements (the `ALTER TABLE` part of migration 009) from the Supabase SQL editor as the project owner; the data repair in the same file needs no ownership and runs anywhere.
- **Protected routes return 307 to `/auth/login`** — the middleware redirect for signed-out visitors. Sign in first.

