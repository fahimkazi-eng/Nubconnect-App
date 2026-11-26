// ============================================================================
// NUBCONNECT — Auth callback.
// Handles both OAuth/PKCE `?code=` redirects and email OTP links
// (`?token_hash=&type=`), then forwards to a safe in-app path.
// ============================================================================
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNext(raw: string | null): string {
  if (!raw) return '/home';
  // Only allow same-origin absolute paths; reject protocol-relative URLs.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/home';
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { origin, searchParams } = url;
  const next = safeNext(searchParams.get('next'));
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth/login?error=backend_not_configured`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
}
