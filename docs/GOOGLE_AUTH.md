# NUBCONNECT — Google sign-in configuration

Google authentication is **implemented end-to-end** in the app (PKCE flow,
`/auth/callback` route, safe `next=` return, provider-error handling) but the
button only appears when the deployment explicitly enables it. Until the steps
below are complete, nothing about Google auth runs and the UI makes no claim
about it.

This is the exact configuration needed to turn it on.

## 1. Google Cloud console

1. Create (or reuse) a Google Cloud project at https://console.cloud.google.com.
2. Configure the OAuth consent screen (External). Suggested public details:
   - Application name: `NUB Connect`
   - Authorized domain: your production domain (e.g. `nub-connect-live.vercel.app`)
   - Developer contact: your email
3. Create **OAuth 2.0 Client ID** → Web application.
   - **Authorized JavaScript origins**: your site origin(s)
   - **Authorized redirect URI**: your Supabase project's Google callback URL:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     (copy it verbatim from Supabase → Authentication → Providers → Google — do
     not guess it).
4. Copy the **Client ID** and **Client Secret**. Treat the secret as a credential.

## 2. Supabase dashboard

1. Open your project → **Authentication → Providers → Google**.
2. Enable the provider.
3. Paste the Google **Client ID** and **Client Secret** from step 1.
4. Save.

## 3. Supabase redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your canonical production origin, e.g.
   `https://nub-connect-live.vercel.app`.
3. Add to **Redirect URLs** (exact values, one per line):
   ```
   https://<your-project>.vercel.app/auth/callback
   https://<your-preview-domain>.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
4. The app only ever redirects to **same-origin** `/auth/callback` paths
   (`safeNext` in `src/app/auth/callback/route.ts` rejects anything else), so no
   open-redirect risk is introduced here.

## 4. Vercel environment variable

Set this on the Vercel project (Production and Preview):

```
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
```

It is a **public, non-secret** flag: it only controls whether the
"Continue with Google" button renders (`isGoogleAuthEnabled()` in
`src/lib/auth.ts`). Leave it unset/`false` and the button is not shown — the
email/password flow remains the supported path.

## 5. Verify

1. Redeploy (environment changes require a new build).
2. Open `/auth/login`:
   - Without step 4 → no Google button; email/password sign-in unchanged.
   - With steps 1–4 → a "Continue with Google" button appears under the form.
3. Click it: Google consent screen → returns to `/auth/callback?code=…` →
   redirects to the originally requested `next=` path (or `/home`).
4. If the user cancels or Google errors, they land back on `/auth/login` with
   the provider error shown (never a silent failure).
5. Confirm an account created via Google is still **not** NUB-Verified —
   verification is a separate review by university staff, independent of how
   the session was created.

## What is NOT automated (by design)

- Google auth does **not** grant NUB verification, admin roles, or any
  elevated privileges. No such grant exists in the code.
- Accounts created through Google are linked to existing profiles by email
  through Supabase's standard account-linking behavior; NUB Connect never
  silently merges identities or creates duplicate profiles from an email alone.
