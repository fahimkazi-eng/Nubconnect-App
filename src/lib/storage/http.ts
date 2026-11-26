// ============================================================================
// NUBCONNECT — Shared HTTP helpers for the storage routes.
// Server-only: authentication always comes from the request cookies, never
// from a client-supplied user id or token.
// ============================================================================
import 'server-only';

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '../supabase/server';

export type StorageAuthResult =
  | { readonly ok: true; readonly client: SupabaseClient; readonly userId: string }
  | { readonly ok: false; readonly response: NextResponse };

export function noStoreJson(body: unknown, status: number = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function authenticateStorageRequest(): Promise<StorageAuthResult> {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      response: noStoreJson(
        { error: 'Accounts are not configured on this deployment.' },
        503,
      ),
    };
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: noStoreJson({ error: 'Sign in to manage media.' }, 401) };
  }

  return { ok: true, client, userId: data.user.id };
}

export type JsonObjectResult =
  | { readonly ok: true; readonly body: Record<string, unknown> }
  | { readonly ok: false; readonly status: number; readonly error: string };

/** Parse a small JSON object without buffering an unbounded request body. */
export async function readJsonObject(
  request: Request,
  maxBytes: number = 16 * 1024,
): Promise<JsonObjectResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Could not read the request body.' };
  }

  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: 'The request body is too large.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'Expected a JSON object.' };
  }

  return { ok: true, body: parsed as Record<string, unknown> };
}
