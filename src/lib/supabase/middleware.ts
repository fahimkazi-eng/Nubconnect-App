// ============================================================================
// NUBCONNECT — Session refresh + route protection.
//
// Active only when a Supabase backend is configured. In demo mode every route
// stays open and clearly labelled; we never simulate a login wall.
// ============================================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function backendConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes('your-project-id')
  );
}

/** App routes that require a signed-in student once accounts are live. */
const PROTECTED_PREFIXES = [
  '/home',
  '/circle',
  '/circles',
  '/messages',
  '/roommates',
  '/marketplace',
  '/more',
  '/profile',
  '/settings',
  '/search',
  '/notifications',
  '/academic',
  '/department',
  '/events',
  '/opportunities',
  '/lost-found',
  '/saved',
  '/passport',
  '/campus-services',
  '/clubs',
  '/groups',
  '/honours',
];

/** Auth screens that a signed-in student should not see again. */
const AUTH_ENTRY_PAGES = ['/auth/login', '/auth/register', '/auth/forgot-password'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!backendConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase; do not trust getSession() alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && AUTH_ENTRY_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
