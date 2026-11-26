// ============================================================================
// NUBCONNECT — POST /api/storage/upload-url
//
// Issues a short-lived upload URL only after cookie authentication, profile
// checks and server-side type/size/key validation. Credentials stay on the
// server; the response contains only an expiring URL and the object key.
// ============================================================================
import { isMediaKind } from '@/lib/storage/provider';
import { createUploadAuthorization } from '@/lib/storage/server';
import {
  authenticateStorageRequest,
  noStoreJson,
  readJsonObject,
} from '@/lib/storage/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateStorageRequest();
  if (!auth.ok) return auth.response;

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return noStoreJson({ error: parsed.error }, parsed.status);

  const { kind, fileName, mimeType, sizeBytes } = parsed.body;

  if (!isMediaKind(kind)) {
    return noStoreJson({ error: 'Unsupported media kind.' }, 400);
  }
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return noStoreJson({ error: 'A file name is required.' }, 400);
  }
  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    return noStoreJson({ error: 'A MIME type is required.' }, 400);
  }
  if (typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return noStoreJson({ error: 'A positive integer file size is required.' }, 400);
  }

  const result = await createUploadAuthorization(auth.client, auth.userId, {
    kind,
    fileName,
    mimeType,
    sizeBytes,
  });

  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson(result.data, 200);
}
