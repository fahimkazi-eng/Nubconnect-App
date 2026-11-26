// ============================================================================
// NUBCONNECT — /api/storage/object
//
// DELETE removes at most 20 objects owned by the signed-in student. GET
// resolves an owned object to a public URL or a short-lived private URL.
// Neither verb trusts a key without checking the owner folder first.
// ============================================================================
import type { NextRequest } from 'next/server';

import { isMediaKind } from '@/lib/storage/provider';
import {
  MAX_DELETE_KEYS,
  createMediaAccessUrl,
  deleteMediaObjects,
} from '@/lib/storage/server';
import {
  authenticateStorageRequest,
  noStoreJson,
  readJsonObject,
} from '@/lib/storage/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await authenticateStorageRequest();
  if (!auth.ok) return auth.response;

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return noStoreJson({ error: parsed.error }, parsed.status);

  const { kind, keys } = parsed.body;
  if (!isMediaKind(kind)) {
    return noStoreJson({ error: 'Unsupported media kind.' }, 400);
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    return noStoreJson({ error: 'Provide at least one storage key.' }, 400);
  }
  if (keys.length > MAX_DELETE_KEYS || !keys.every((key) => typeof key === 'string')) {
    return noStoreJson(
      { error: `Delete at most ${MAX_DELETE_KEYS} storage keys at a time.` },
      400,
    );
  }

  const result = await deleteMediaObjects(auth.client, auth.userId, {
    kind,
    keys: keys as string[],
  });

  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson(result.data, 200);
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateStorageRequest();
  if (!auth.ok) return auth.response;

  const kind = request.nextUrl.searchParams.get('kind');
  const key = request.nextUrl.searchParams.get('key');
  const expiresRaw = request.nextUrl.searchParams.get('expiresInSeconds');

  if (!isMediaKind(kind)) {
    return noStoreJson({ error: 'Unsupported media kind.' }, 400);
  }
  if (!key) {
    return noStoreJson({ error: 'A storage key is required.' }, 400);
  }

  let expiresInSeconds: number | undefined;
  if (expiresRaw !== null) {
    const parsed = Number(expiresRaw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return noStoreJson({ error: 'Invalid URL expiry.' }, 400);
    }
    expiresInSeconds = parsed;
  }

  const result = await createMediaAccessUrl(auth.client, auth.userId, {
    kind,
    key,
    expiresInSeconds,
  });

  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson(result.data, 200);
}
