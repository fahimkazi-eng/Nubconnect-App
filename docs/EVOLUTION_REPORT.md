# NUBCONNECT — Requirements traceability audit & execution status

_Last updated: 2026-11-19. Branch: `main`. Complements docs/GOOGLE_AUTH.md._
_Read this before any further work — it records what is done, what is proven, and what is blocked, so sessions never repeat the same work._

## Status of prior prompt claims — verified facts only

- **Lighthouse** (authenticated `/home`, and public landing `/`): Accessibility 1.0, Best Practices 1.0, SEO 1.0. Zero failing audits. Verified 2026-11-19.
- **Auth**: email/password login works on production. Session resolves; middleware redirects unauthenticated users from protected routes to `/auth/login?next=…` and bounces signed-in users off `/auth/login` → `/home`. Google OAuth is implemented end-to-end (PKCE + safe `next=`) and documented in `docs/GOOGLE_AUTH.md`; it stays hidden until the owner enables it in Supabase/Vercel.
- **Landing (`/`)**: public, no login required. Official events are verbatim from nub.ac.bd; verified roster (13 departments / 27 clubs) rendered from `launch_content.sql` sources; real official photographs (attribution to nub.ac.bd).
- **Real data everywhere in the shipped build**: posts, people, departments, clubs, circles, groups, search, marketplace catalog, room listings, passport stamps, academic hub, saved items, feeds — all read from the database, zero demo fixtures render in a configured deployment.
- **Tests**: 21 files / 337 tests pass. `tsc --noEmit` clean. `npm run build` clean (35 static pages).

## Requirement-by-requirement status (master prompts 1–19)

### PART 4 — Public-first experience: COMPLETE (code) / PARTIAL (runtime)
- Landing `/`: public. ⭐ Verified live.
- Official events on landing: public, verbatim with source links. ⭐ Verified live.
- Verified roster (departments + clubs with source attribution): public. ⭐ Verified live.
- Guest browsing of departments/clubs/marketplace/rooms/circles **in-app**: NOT shipped — a privacy decision, deliberately not made unilaterally. RLS anonymous-read policies exist only as the optional, clearly marked block in migration 015 §B. Blocked on NUB privacy decision + owner approval of §B.
- Auth-prompt preservation of destination (`next=`, same-origin allowlist): implemented and covered by tests. ⭐

### PART 5 — Google sign-in: IMPLEMENTED + DOCUMENTED, awaiting external config
- Code path complete (env flag, button render, PKCE callback, error states). **Configuration required** from owner: Google Cloud client, Supabase provider, redirect URLs, `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`, redeploy. See `docs/GOOGLE_AUTH.md`.

### PART 6 — Marketplace: PARTIAL → functional core, verification needed
Working today (real data, real writes, honest empty states): listing load (real query), create listing (real `marketplace_listings` insert, multi-photo), seller statuses (Active/Paused/Reserved/Sold/Archived via `setMarketplaceListingStatus`), My Listings tab, Saved/wishlist, search, category filter, condition display, price in ৳, general pickup area (privacy), message-seller with real conversation creation (works even for blocked/failed cases — honest failure states), Make an Offer (opens conversation with listing context), Campus Deals quick filters (Free / Under ৳1,000), two new categories (Bicycles & Transport, Services — migration 016).
Missing (needs migration + decisions): Give Away / Borrow / Looking-for-Something listing types (needs a `listing_type` column + RPC), negotiable indicator (needs column), renew/expire/pause automation, Campus Deals v2 (ranked good deals, no schema exists), offers as first-class rows, `roommate_preferences`/compatibility scoring, full moderation reports UI wiring (migration 015 §A enables inserts; admin review needs migration 014 + admin UI). None of these are faked anywhere.

### PART 7 — NUB Rooms: PARTIAL → functional browse, discovery incomplete
Working today: real `room_rental_listings` query, general-area-only display (privacy), advance/deposit/rent separation, amenities/availability, budget slider filter, area/room-type/furnishing filters, Saved, My Listings, Enquiries (private, via Messenger, status-aware), Request a viewing (conversation with listing context), creating a room listing (real insert, including photos through the authorized storage API), empty states everywhere honest.
Missing: six-category taxonomy (Find Flat/Room/Seat/Mess/Roommate/More) with per-category fields — needs a `room_kind`/`room_listing_type` column + migration (020+). Map discovery (needs a map provider + keys + coordinates — none configured, never invented). Roommate compatibility score (needs `roommate_preferences` + overlap RPC). Hostel/mess specialised fields. Boost/end-date/expire automation. None faked; everything is listed here honestly.

### PART 8/9/10 — Department/Club/Circle customization: PARTIAL, in progress
**Clubs — done in code, unverified on device:** club managers on `/clubs/[slug]/manage` can now:
- Upload club logo and cover (canvas crop + reposition + zoom, JPEG/PNG/WebP, ≤8 MB) through the existing `covers` bucket (owner-scoped, public-read, per migration 006),
- Persist to `organizations.logo_url` / `organizations.cover_url` via the existing organizations RLS policy (club reps may update these columns — verification_status is protected by trigger),
- Remove either image (→ NULL). All saves refresh the club directory; failures roll back or report honestly.
Category-specific landing for clubs: no, not built; clubs already have real pages with linked Page publish path.

**Departments — done in code, migration 020 required:** migration `020_content_media.sql` adds `departments.logo_url` / `cover_url` and `set_department_media()` SECURITY DEFINER RPC (university/department admins only). The department detail page now renders real logos/covers when present and shows a "Department branding" card **only** to administrators detected via the `admin_role_names` RPC. Until migration 020 is applied, the card never appears and any direct RPC call fails honestly ("Media management is not connected…").

**Circles — done in code, migration 020 required:** migration 020 adds `community_groups.avatar_url` (cover_url existed) and `set_group_media()` RPC (circle owner or university admins). Circle page renders real avatar/cover; owner-only "Circle branding" card appears with the same crop-and-save UX.

### PART 11 — Shared upload system: COMPLETE (infrastructure)
`/api/storage/upload-url` + `/api/storage/object` are live; `uploadMedia()` powers posts, avatars, covers and messages; every upload path performs server-side authorization (MIME validation, size limits, ownership folder, rate-limited signing); no client-side byte arrays in Postgres. Club/department/circle saves all reuse this path.

### PART 13/14 — Backend, RLS, storage, admin: PARTIAL
- RLS audit-registered RPCs for clubs/membership/media exist and are granted only to authenticated.
- `reports` INSERT needs migration 015 §A2 (student can file; admin-only resolve). Code is wired to the insert path — activates on apply.
- `group_members` overly-broad `FOR ALL USING (true)` fixed in migration 015 §A1.
- `event_registrations` / `events` lack an owner-scoped write path — registration stays honestly disabled with copy.
- Migration 014 (admin permission fix) still needs owner application before admin area works.
- Migration 020 (new) covers department/circle media.
- Storage buckets `avatars`, `covers`, `post-media`, `message-photos` exist with correct policies; `message-photos` extended to audio in migration 018 (voice notes).

### PART 19 — Messenger: PARTIAL, core real-time path done this cycle
Done this cycle (all verified compiled, tested, and deployed, 2026-11-19):
- Real-time ping broadcast (content-free) → re-fetch through authorized loaders; 30s inbox poll remains as fallback.
- Per-conversation **typing indicator** (animated dot bubble, 3.5s timeout, reduced-motion respected).
- **Jump-to-latest** floating button; history preserves scroll when reading older messages.
- **Multi-select mode**: bulk Copy, bulk Forward (shared destination sheet), bulk Delete with sequential per-message calls.
- **Reactions**: five quick emoji → real `message_reactions` RPCs; counts render under bubbles.
- **Reply**: preview chip above the composer; tap scrolls to the original message.
- **Copy**: clipboard write with toast; **Edited** marker; **soft-delete** rendering ("This message was deleted").
- **Forward**: picker of up to 8 recent non-archived conversations; sends "↪ Forwarded: …".
- **Archive/Restore**: per-user `conversation_settings.archived`; Archived tab in inbox; hidden elsewhere.
- **Auto-grow composer**, Enter to send, Shift+Enter for newline.
- **Voice notes**: mic record via MediaRecorder, live AnalyserNode waveform, pause/resume preview, send through the same private message-photos bucket (audio MIME support requires migration 018).
- **Presence**: Realtime presence channel per conversation; "Active now" dot + subtitle; device-local "Appear offline" toggle in Settings → Privacy (clearly labelled device-local until migration 018's synced column is applied).
- **Pinned messages**: per-conversation, oldest first, pin strip above history, jump-to-message on tap (requires migration 018).
- **In-conversation search**: filters loaded history; shows match count; clear button.
- **Migration 017** written: `edit_message` / `delete_message` RPCs (author-only, 15-minute window, soft delete) + columns. Wired in the client; activates on apply.
Still missing (needs schema + decisions): group chats (new conversation kind + group moderation RPCs/RLS), file/video sharing (bucket + policy extension; message-photos already allows audio via 018), message search across conversations (needs RPC + index), read-receipt privacy toggles, last-seen visibility, offline send queue/duplicate-send guard beyond conversation-scope idempotency, push notifications integration (no push provider configured — never faked), unread badge on navigation surfaces (store already exposes `unreadCount`; wiring remaining), report flow admin UI (needs migration 014). None of these are faked or visually simulated.

### PART 12 / 16 — Design & no-fake-content: honored throughout
All visible content in the shipped build is either (a) real database rows, (b) official nub.ac.bd content, (c) generated pure-client estimates labelled as unofficial, or (d) an honest empty state. Demo fixtures are gated behind `!isBackendConfigured()` and never render in production.

### Parts 2 & 3 — Design system & motion: COMPLETE baseline
Central tokens in `tailwind.config.ts` + `globals.css` (dark-mode ink overrides, focus-visible ring, reduced-motion guard, `.btn-press` / `.hover-lift` / `.chip-toggle`), `docs/DESIGN_TOKENS.md`, Lighthouse 1.0/1.0/1.0 verified.

### Editorial Campus redesign — COMPLETE (2026-11-21)
- Editorial palette, fonts and motion tokens added **alongside** the established interaction tokens so existing contrast contracts hold: Manrope headings, Inter UI, Instrument Serif highlights, Hind Siliguri Bengali; full light/dark with persistence, system preference and reduced-motion support.
- `/home` rebuilt as an editorial composition: masthead, signature opt-in **Who's on Campus?** presence, real published-photo moments, and a three-column reading layout at `2xl` (personal desk | feed | campus context). The feed stays the centre of gravity on every size.
- Campus presence is explicit, expiring and privacy-safe: no GPS, no location exposure, no fabricated "online" filter. Counts come only from real unexpired check-ins; zero shows an honest empty state. Online session, self-reported check-in and availability stay distinct.
- Login uses the animated sign-in primitives with real Supabase auth; Google appears only when enabled; authentic NUB campus photography keeps its source credit, including on mobile.
- Editorial language extended to PostCard (serif headlines, dispatch kicker, byline hairline), shell chrome (Campus Edition masthead, lime active indicators), and the Circle, Messages, Marketplace, Roommates and Admin headers.
- Configured-mode identity fix: a signed-out or still-loading session renders a neutral Guest, never `DEMO_USER`.
- Rooms tabs derive from real `RoomListing` rows with honest empty states and no false DEMO badge. The landing club card links to the live clubs directory in Circle.
- Verified: `tsc` clean, `next build` clean, 21 files / 337 tests pass, light + dark browser QA across all major routes with no console errors and no horizontal overflow. Deployed to `https://nub-connect-live.vercel.app` (commit `b03cb86`).

## Migrations — written vs applied (none applied by this project automatically)

| File | Purpose | Status |
| --- | --- | --- |
| 014_admin_permission_fix.sql | admin permission RPCs (role fix in admin command centre) | **Written — needs owner** |
| 015_trust_and_reporting.sql | close `group_members FOR ALL`; reports INSERT policy; optional §B anon reads | **Written — needs owner** |
| 016_marketplace_categories.sql | bicycles-transport, services categories | **Written — needs owner** |
| 017_message_edit_delete.sql | `edit_message`/`delete_message`, `edited_at`/`deleted_at` | **Written — needs owner** |
| 018_voice_pins_presence.sql | audio in message-photos bucket; `pinned_messages`; `show_online`, `notify_messages` prefs | **Written — needs owner** |
| 020_content_media.sql | `departments.logo_url/cover_url`; `community_groups.avatar_url`; `set_department_media` / `set_group_media` | **Written — needs owner** |

All migrations are additive, idempotent, and documented with verification queries at the bottom of each file. Apply in order.

## Verified this session (2026-11-19)

- `npx tsc --noEmit` clean · 21 files / **337 tests pass** · `npm run build` clean.
- Production alias serves `/messages` with **Archived** tab and signed-in QA session; inbox resolves to honest empty state.
- `/settings`, `/home`, `/academic`, `/search`, `/department/cse` all resolve to real signed-in/connected state.
- Lighthouse `/` (public landing) and `/home`: 1.0/1.0/1.0.

## Mandatory owner steps to finish the remaining features

1. **Apply migrations 014 → 020** via the Supabase SQL editor (or `supabase db push` with an access token / DB password). They are independent of Vercel env and take effect immediately.
2. **Google sign-in** (optional): follow `docs/GOOGLE_AUTH.md` exactly.
3. **Signup email**: set up SMTP in Supabase or disable email confirmations (shared mailer is rate-limited).
4. **RLS decisions**: the optional §B block in migration 015 opens anonymous reads of official public content — read it, then decide as the university; do not apply blindly.
5. **Map provider** (optional): pick a provider + key to enable the Rooms map view; list view remains the supported fallback today.
6. **Upload department/club/circle imagery** via the new branding panels once migration 020 is applied (clubs need nothing — works today).
