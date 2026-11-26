// ============================================================================
// NUBCONNECT — browser-side media upload helper.
//
// The browser never chooses a storage bucket, path, MIME type variant or
// credential. It asks the API for an authorization, uploads with the returned
// short-lived URL, and hands the caller a canonical key plus a usable URL.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  cacheControlFor,
  getMediaRule,
  type MediaKind,
  type StorageProvider,
} from './provider';

export interface MediaUploadInput {
  readonly kind: MediaKind;
  readonly file: File;
}

export interface MediaUpload {
  /** Canonical server-owned key. Store this, never a client-invented path. */
  readonly key: string;
  /** Provider-specific path, including the Supabase signed-upload token path. */
  readonly storagePath: string;
  /** Public URL, or a short-lived owner URL for private media. */
  readonly url: string;
  readonly provider: StorageProvider;
}

export type MediaUploadResult =
  | { ok: true; data: MediaUpload }
  | { ok: false; error: string };

/** Remove objects the server confirmed this student owns after a failed write. */
export async function deleteUploadedMedia(kind: MediaKind, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await fetch('/api/storage/object', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, keys: [...keys] }),
    });
  } catch {
    // Best-effort cleanup only: the original failure is the actionable error.
  }
}

interface UploadAuthorization {
  readonly provider: StorageProvider;
  readonly key: string;
  readonly storagePath: string;
  readonly uploadUrl: string;
  readonly publicUrl?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly token?: string;
  readonly expiresInSeconds: number;
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'error' in value) {
    const message = (value as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isAuthorization(value: unknown): value is UploadAuthorization {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UploadAuthorization>;
  return (
    (candidate.provider === 'r2' || candidate.provider === 'supabase') &&
    typeof candidate.key === 'string' &&
    candidate.key.length > 0 &&
    typeof candidate.storagePath === 'string' &&
    candidate.storagePath.length > 0 &&
    typeof candidate.uploadUrl === 'string' &&
    candidate.uploadUrl.length > 0 &&
    (candidate.publicUrl === undefined || typeof candidate.publicUrl === 'string') &&
    (candidate.token === undefined || typeof candidate.token === 'string') &&
    typeof candidate.expiresInSeconds === 'number'
  );
}

/**
 * Fetch an owned object URL when the provider did not return a permanent one.
 * This is used for private media; callers should normally persist `key` and
 * resolve a fresh URL when the object is displayed.
 */
async function resolveUrl(
  kind: MediaKind,
  key: string,
  publicUrl: string | undefined,
): Promise<string | null> {
  if (publicUrl) return publicUrl;

  const params = new URLSearchParams({ kind, key });
  const response = await fetch(`/api/storage/object?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!response.ok) return null;

  const body = await readJson(response);
  if (!body || typeof body !== 'object') return null;
  const url = (body as { url?: unknown }).url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/**
 * Upload one validated file through the server-authorized storage route.
 *
 * `client` is only needed for the Supabase signed-upload adapter. R2 uploads
 * are a plain browser PUT to the presigned URL.
 */
export async function uploadMedia(
  client: SupabaseClient,
  input: MediaUploadInput,
): Promise<MediaUploadResult> {
  const { kind, file } = input;
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
    return { ok: false, error: 'Choose a file to upload.' };
  }

  let authorizationResponse: Response;
  try {
    authorizationResponse = await fetch('/api/storage/upload-url', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
  } catch {
    return { ok: false, error: 'Could not reach the upload service. Check your connection.' };
  }

  const authorizationBody = await readJson(authorizationResponse);
  if (!authorizationResponse.ok) {
    return {
      ok: false,
      error: errorMessage(
        authorizationBody,
        `Upload was rejected (${authorizationResponse.status}). Please try again.`,
      ),
    };
  }
  if (!isAuthorization(authorizationBody)) {
    return { ok: false, error: 'The upload service returned an invalid response.' };
  }

  const authorization = authorizationBody;
  if (authorization.provider === 'supabase') {
    if (!authorization.token) {
      return { ok: false, error: 'The upload service did not return a valid token.' };
    }
    const bucket = getMediaRule(kind).supabaseBucket;
    const { error } = await client.storage
      .from(bucket)
      .uploadToSignedUrl(authorization.storagePath, authorization.token, file, {
        contentType: file.type,
        cacheControl: cacheControlFor(getMediaRule(kind).visibility),
      });
    if (error) {
      return { ok: false, error: error.message || 'The upload failed. Please try again.' };
    }
  } else {
    const headers = new Headers(authorization.headers ?? {});
    // Browsers set Content-Length from the body and forbid scripts from
    // setting it; the presigned URL still verifies the exact byte count.
    headers.delete('Content-Length');
    if (!headers.has('Content-Type')) headers.set('Content-Type', file.type);
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', cacheControlFor(getMediaRule(kind).visibility));
    }

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(authorization.uploadUrl, {
        method: 'PUT',
        headers,
        body: file,
      });
    } catch {
      return { ok: false, error: 'Could not reach the upload service. Check your connection.' };
    }
    if (!uploadResponse.ok) {
      return { ok: false, error: `Upload failed (${uploadResponse.status}). Please try again.` };
    }
  }

  const url = await resolveUrl(kind, authorization.key, authorization.publicUrl);
  if (!url) {
    return { ok: false, error: 'The file uploaded but its link could not be resolved.' };
  }

  return {
    ok: true,
    data: {
      key: authorization.key,
      storagePath: authorization.storagePath,
      url,
      provider: authorization.provider,
    },
  };
}
