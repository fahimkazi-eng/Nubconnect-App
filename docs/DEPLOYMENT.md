# NUBCONNECT — Deployment & Workflow Guide

This document describes how NUBCONNECT gets from a local change to the live
website. One repository, one active Vercel project, no duplicates.

| Piece | Value |
| --- | --- |
| GitHub repository | `fahimkazi-eng/NUB-CONNECT` |
| Vercel project | `nub-connect-live` (`fahimkazi-eng` team) |
| Production branch | `main` |
| Production URL | https://nub-connect-live-fahimkazi-eng.vercel.app |
| Framework | Next.js — set explicitly on the project, build `npm run build`, Node 26.x |

> **Deploy only through `nub-connect-live`.** Two older projects are preserved
> as backups and must stay disconnected from Git:
>
> - `nub-connect` — the original project. A suspended Vercel Marketplace
>   Supabase store (`supabase-byzantine-clock`) attached to it blocks every
>   deployment before the build can start ("Integration provisioning error —
>   Resource provisioning failed"), so it never produced a successful
>   deployment. Its Git link is disconnected; the project is kept as a
>   backup only.
> - `nub-connect.com` — a short-lived duplicate that also deployed this
>   repository (two deployments per push). Git link disconnected.
>
> `nub-connect-live` was created as the clean replacement on 2026-11-11 and
> is the only project connected to this repository.

## The workflow

```
feature branch  ──push──▶  GitHub  ──▶  Vercel PREVIEW deployment
     │                                       │
     │                                  test preview
     ▼                                       ▼
   commit(s)  ──▶  Pull Request into main  ──merge──▶  Vercel PRODUCTION deploy
```

1. **Develop** on a feature branch (`feature/<name>`), cut from `main`.
2. **Test locally**: `npm run dev`, then the gate commands below.
3. **Push** the branch — Vercel automatically builds a **Preview** deployment
   for every feature branch. Preview URLs follow
   `https://nub-connect-live-git-<branch>-fahimkazi-eng.vercel.app`.
4. **Review** the preview, open a PR into `main`.
5. **Merge** the PR (approved changes only) — Vercel automatically deploys
   `main` to production. The live URL updates when the deployment is Ready.

## Local gate before pushing

```bash
npx tsc --noEmit     # type check
npm test             # unit tests (should be all green)
npm run build        # production build (must exit 0)
```

## Supabase & demo mode

The app reads two public environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

When either is missing, **every surface falls back to the clearly-labelled
DEMO dataset** — never silently pretending demo content is live data. The
Vercel project **is** configured for the live Supabase project
(`bevjzwdptfmugfrxrjnd`), for Preview and Production, so both environments
run against the real backend. In that configured mode, accounts, profiles,
messaging, clubs, honours, the feed, listings, the people directory and
Campus Pulse all read real rows; a surface with no data shows an honest
empty state rather than demo content. The demo dataset never appears in a
configured build, and a signed-out visitor is never shown a demo student as
their own identity. Features without backing tables (for example Stories,
event registration, an official academic-calendar sync, Opportunities,
Lost & Found and Campus Services) state their limitation in the UI instead
of inventing data.

### The shared mailer is rate-limited

Supabase's built-in SMTP allows only a handful of confirmation emails per
hour, so sign-up currently fails with `over_email_send_rate_limit`. Before
the campus launch, either turn off **Confirm email** in Authentication →
Sign In / Providers → Email (NUB Verified stays a separate staff review) or
connect a custom SMTP provider. Nothing in the app can lift this limit — it
is a project-level setting in the Supabase dashboard.

### Applying migrations

1. Create a Supabase project at [supabase.com](https://supabase.com)
   (the free tier pauses projects after ~7 days of inactivity — keep that in
   mind for a campus app with predictable traffic).
2. In the Supabase SQL editor, run the migrations **in order**:
   `supabase/migrations/001_initial_schema.sql` →
   `002_rls_policies.sql` → `003_social_experience.sql` →
   `004_campus_orbit.sql`, then optionally seed the verified NUB tenant with
   `supabase/seed/seed_nub.sql`. All migrations are additive and safe to run
   on a fresh project. Row Level Security is enabled on every table.
   `supabase/apply_all.sql` bundles all of them plus the seed in one paste —
   rebuild it with `node scripts/build-apply-all.mjs` after editing a
   migration.
3. In Vercel: **Project → Settings → Environment Variables**, add the two
   public variables above (for Preview and Production), then redeploy.
   Optionally set `NEXT_PUBLIC_DEFAULT_UNIVERSITY_SLUG` (defaults to `nub`).

> `auth.users` is owned by Supabase Auth, so the `ALTER TABLE` step in
> migration 009 only runs when it is applied by the project's SQL owner
> (the Supabase SQL editor). The data repair in the same file needs no
> ownership and runs anywhere.

## Project settings worth knowing

- **Framework is set explicitly.** Projects created via the CLI
  (`vercel project add`) start with *no* framework preset. The first
  deployment then builds an empty site that returns
  `X-Vercel-Error: NOT_FOUND` despite showing "Ready". Fixed once with
  `vercel project update nub-connect-live --framework nextjs` and a rebuild.
- **Deployment protection is disabled** (Vercel SSO login wall off), so the
  production URL is publicly reachable — same as the previous live V1 site.
  Preview URLs are public too; do not share preview URLs of unreleased work
  if that matters.
- **`vercel git connect` sets the production branch from the branch checked
  out at connect time.** Always run it while on `main` (or verify the
  production branch in Project → Settings → Git afterwards). On 2026-11-11
  it was initially connected from a feature branch and had to be fixed by
  disconnecting and reconnecting while on `main`.
- **`vercel git connect`/`disconnect` need the exact origin URL**
  (`https://github.com/fahimkazi-eng/NUB-CONNECT.git`) — passing a URL that
  differs from the local remote (e.g. without `.git`) triggers an
  interactive prompt that cannot be answered in non-interactive shells.

> History note: the old `nub-connect` project still carries the suspended
> Marketplace store above. Detaching it requires a human at the terminal or
> dashboard (the CLI deliberately reserves
> `vercel storage disconnect supabase-byzantine-clock` for interactive use).
> The suspended store is harmless while that project stays disconnected —
> it only blocks deployments *of that project*. If managed storage is ever
> re-added to `nub-connect-live`, watch its status: a suspended resource
> blocks all deployments again.

## Rules that keep this stable

- Never commit `.env` files or service-role keys (`.gitignore` already covers
  them; see `.env.example` for the variable names).
- Never force-push; keep history linear on feature branches.
- The `.vercel/` directory holds the local project link and is gitignored —
  keep it out of commits.
- Migrations are applied from the Supabase dashboard, **never** during the
  Vercel build.
- Production only changes through merges into `main`.
- Never connect another Vercel project to this repository —
  `nub-connect-live` is the single deployment path.
