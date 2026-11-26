// ============================================================================
// NUBCONNECT — Server-side media storage orchestration.
//
// Chooses R2 when it is configured and falls back to Supabase Storage
// otherwise. All authorization decisions happen here, before a temporary URL
// is issued or an object is deleted. Secrets never leave this module.
// ============================================================================
import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  MEDIA_KINDS,
  MEDIA_RULES,
  buildObjectKey,
  cacheControlFor,
  canonicalMimeType,
  isMediaKind,
  isOrphanObjectKey,
  isOwnedKey,
  isR2Configured,
  isSafeObjectKey,
  selectStorageProvider,
  toSupabaseStoragePath,
  validateMediaFile,
  type MediaKind,
  type MediaVisibility,
  type StorageProvider,
} from './provider';
import {
  createR2UploadUrl,
  deleteR2Objects,
  r2ObjectUrl,
  r2SignedDownloadUrl,
} from './r2';

export const MAX_DELETE_KEYS = 20;
export const MAX_ORPHAN_DELETE_KEYS = 200;
export const R2_UPLOAD_TTL_SECONDS = 5 * 60;
export const SUPABASE_SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60;
export const DEFAULT_PRIVATE_URL_TTL_SECONDS = 10 * 60;
export const MAX_PRIVATE_URL_TTL_SECONDS = 60 * 60;

export type StorageActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error: string };

export interface CreateUploadUrlInput {
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface UploadAuthorization {
  readonly provider: StorageProvider;
  /** Canonical key used for ownership checks and returned to the client. */
  readonly key: string;
  /** Provider-specific object path (same as `key` for R2). */
  readonly storagePath: string;
  readonly uploadUrl: string;
  readonly publicUrl?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Present for Supabase signed uploads (`uploadToSignedUrl`). */
  readonly token?: string;
  readonly expiresInSeconds: number;
}

interface StorageProfile {
  is_verified_student: boolean | null;
  is_suspended: boolean | null;
  primary_university_id: string | null;
}

function logStorageError(operation: string, message: string): void {
  // Log the provider message on the server only. The browser gets a calm,
  // generic error so internal bucket names and provider details do not leak.
  console.error(`[storage] ${operation} failed: ${message}`);
}

function mapStorageError(message: string): { status: number; error: string } {
  const lower = message.toLowerCase();
  if (lower.includes('bucket not found') || lower.includes('no such bucket')) {
    return {
      status: 503,
      error: 'Photo storage is not configured yet. Ask an administrator to create the storage bucket.',
    };
  }
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('not authorized') ||
    lower.includes('unauthorized')
  ) {
    return { status: 403, error: 'You do not have permission to use that storage location.' };
  }
  if (lower.includes('payload too large') || lower.includes('maximum allowed size')) {
    return { status: 413, error: 'That file is too large for the storage bucket.' };
  }
  if (lower.includes('mime type')) {
    return { status: 415, error: 'That file type is not accepted by the storage bucket.' };
  }
  return { status: 502, error: 'Storage is temporarily unavailable. Please try again.' };
}

async function verifyStorageActor(
  client: SupabaseClient,
  userId: string,
  kind: MediaKind,
): Promise<StorageActionResult<{ visibility: MediaVisibility }>> {
  // This route only knows the media kind, not the target club/listing/event.
  // Target-level permission (for example "representative of this club") must be
  // enforced by that domain before it asks for an upload URL.
  const { data, error } = await client
    .from('profiles')
    .select('is_verified_student, is_suspended, primary_university_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logStorageError('profile lookup', error.message);
    return { ok: false, status: 503, error: 'Could not verify your account. Please try again.' };
  }
  if (!data) {
    return { ok: false, status: 403, error: 'Complete your student profile before uploading media.' };
  }

  const profile = data as StorageProfile;
  if (profile.is_suspended) {
    return { ok: false, status: 403, error: 'Suspended accounts cannot upload media.' };
  }

  const rule = MEDIA_RULES[kind];
  if (rule.requiresVerifiedStudent && !profile.is_verified_student) {
    return {
      ok: false,
      status: 403,
      error: 'Only NUB Verified students can upload this kind of media.',
    };
  }
  if (rule.requiresUniversity && !profile.primary_university_id) {
    return {
      ok: false,
      status: 403,
      error: 'Link your university in Settings before uploading this kind of media.',
    };
  }

  return { ok: true, data: { visibility: rule.visibility } };
}

/**
 * Authorize an upload and return a short-lived URL.
 *
 * The browser supplies only type/size/name. The key, owner folder and extension
 * are generated here, so a client cannot overwrite another student's object or
 * upload an executable under an image name.
 */
export async function createUploadAuthorization(
  client: SupabaseClient,
  userId: string,
  input: CreateUploadUrlInput,
): Promise<StorageActionResult<UploadAuthorization>> {
  if (!isMediaKind(input.kind)) {
    return { ok: false, status: 400, error: 'Unsupported media kind.' };
  }

  const validation = validateMediaFile(input.kind, {
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  if (!validation.ok) return { ok: false, status: 400, error: validation.error };

  const provider = selectStorageProvider(process.env);
  if (!provider) {
    return { ok: false, status: 503, error: 'Media storage is not configured on this deployment.' };
  }

  const actor = await verifyStorageActor(client, userId, input.kind);
  if (!actor.ok) return actor;

  const rule = MEDIA_RULES[input.kind];
  const key = buildObjectKey(input.kind, userId, validation.safeName, randomUUID());
  const cacheControl = cacheControlFor(rule.visibility);
  // Sign the canonical type, not a client string with parameters or whitespace.
  const contentType = canonicalMimeType(input.mimeType);

  if (provider === 'r2') {
    try {
      const upload = await createR2UploadUrl({
        key,
        contentType,
        sizeBytes: input.sizeBytes,
        cacheControl,
        expiresInSeconds: R2_UPLOAD_TTL_SECONDS,
      });

      let publicUrl: string | undefined;
      if (rule.visibility === 'public') {
        // A public domain is optional: without it the object still uploads and
        // can be read through a signed URL by the owner.
        try {
          publicUrl = r2ObjectUrl(key);
        } catch {
          publicUrl = undefined;
        }
      }

      return {
        ok: true,
        data: {
          provider: 'r2',
          key,
          storagePath: key,
          uploadUrl: upload.uploadUrl,
          publicUrl,
          headers: upload.headers,
          expiresInSeconds: upload.expiresInSeconds,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'R2 upload URL failed.';
      logStorageError('R2 presign', message);
      return {
        ok: false,
        status: message.includes('not configured') ? 503 : 502,
        error: message.includes('not configured')
          ? 'Media storage is not configured on this deployment.'
          : 'Could not create a storage upload URL. Please try again.',
      };
    }
  }

  // Supabase message attachments are conversation-scoped (`<conversation>/<uid>`),
  // which this generic route cannot infer. The existing messaging flow keeps
  // handling them until R2 is enabled or a scoped variant is wired in.
  if (input.kind === 'message') {
    return {
      ok: false,
      status: 503,
      error:
        'Message photos use conversation-scoped storage. Configure Cloudflare R2 or send them through the messaging upload flow.',
    };
  }

  const storagePath = toSupabaseStoragePath(input.kind, userId, key);
  if (!storagePath) {
    return { ok: false, status: 500, error: 'Could not build a safe storage path.' };
  }

  const bucket = rule.supabaseBucket;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error || !data) {
    logStorageError('Supabase presign', error?.message ?? 'no signed upload URL returned');
    const mapped = mapStorageError(error?.message ?? '');
    return { ok: false, status: mapped.status, error: mapped.error };
  }

  const publicUrl =
    rule.visibility === 'public'
      ? client.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
      : undefined;

  return {
    ok: true,
    data: {
      provider: 'supabase',
      key,
      storagePath,
      uploadUrl: data.signedUrl,
      token: data.token,
      publicUrl,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
      expiresInSeconds: SUPABASE_SIGNED_UPLOAD_TTL_SECONDS,
    },
  };
}

export interface DeleteMediaInput {
  readonly kind: MediaKind;
  readonly keys: readonly string[];
}

export interface DeleteMediaResult {
  readonly provider: StorageProvider;
  readonly deleted: string[];
  readonly failed: { key: string; error: string }[];
}

/** Delete up to 20 objects, after proving every key belongs to the caller. */
export async function deleteMediaObjects(
  client: SupabaseClient,
  userId: string,
  input: DeleteMediaInput,
): Promise<StorageActionResult<DeleteMediaResult>> {
  if (!isMediaKind(input.kind)) {
    return { ok: false, status: 400, error: 'Unsupported media kind.' };
  }
  if (!Array.isArray(input.keys) || input.keys.length === 0) {
    return { ok: false, status: 400, error: 'Provide at least one storage key.' };
  }
  if (input.keys.length > MAX_DELETE_KEYS) {
    return { ok: false, status: 400, error: `Delete at most ${MAX_DELETE_KEYS} files at a time.` };
  }
  if (!input.keys.every((key) => typeof key === 'string')) {
    return { ok: false, status: 400, error: 'Every storage key must be a string.' };
  }

  const keys = [...new Set(input.keys)];
  if (!keys.every((key) => isSafeObjectKey(key) && isOwnedKey(input.kind, userId, key))) {
    // All-or-nothing: never delete part of a batch that contains a foreign key.
    return { ok: false, status: 403, error: 'You can only delete files you uploaded.' };
  }

  const provider = selectStorageProvider(process.env);
  if (!provider) {
    return { ok: false, status: 503, error: 'Media storage is not configured on this deployment.' };
  }

  if (provider === 'r2') {
    try {
      const result = await deleteR2Objects(keys);
      return {
        ok: true,
        data: { provider, deleted: result.deleted, failed: result.failed },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'R2 delete failed.';
      logStorageError('R2 delete', message);
      return { ok: false, status: 502, error: 'Could not delete those files. Please try again.' };
    }
  }

  const rule = MEDIA_RULES[input.kind];
  const pathByKey = new Map<string, string>();
  for (const key of keys) {
    const path = toSupabaseStoragePath(input.kind, userId, key);
    if (!path) return { ok: false, status: 403, error: 'You can only delete files you uploaded.' };
    pathByKey.set(key, path);
  }

  const { data, error } = await client.storage
    .from(rule.supabaseBucket)
    .remove([...pathByKey.values()]);

  if (error) {
    logStorageError('Supabase delete', error.message);
    const mapped = mapStorageError(error.message);
    return { ok: false, status: mapped.status, error: mapped.error };
  }

  const removedPaths = new Set((data ?? []).map((entry) => entry.name));
  const deleted = keys.filter((key) => removedPaths.has(pathByKey.get(key) ?? ''));
  const failed = keys
    .filter((key) => !removedPaths.has(pathByKey.get(key) ?? ''))
    .map((key) => ({ key, error: 'The file was missing or already removed.' }));

  return { ok: true, data: { provider, deleted, failed } };
}

export interface MediaAccessInput {
  readonly kind: MediaKind;
  readonly key: string;
  readonly expiresInSeconds?: number;
}

export interface MediaAccess {
  readonly provider: StorageProvider;
  readonly url: string;
  readonly visibility: MediaVisibility;
  /** `null` for public URLs, which do not expire. */
  readonly expiresInSeconds: number | null;
}

/**
 * Resolve media for the owner. Public assets return their CDN URL; private
 * assets always go through a short-lived signed URL.
 */
export async function createMediaAccessUrl(
  client: SupabaseClient,
  userId: string,
  input: MediaAccessInput,
): Promise<StorageActionResult<MediaAccess>> {
  if (!isMediaKind(input.kind)) {
    return { ok: false, status: 400, error: 'Unsupported media kind.' };
  }
  if (!isSafeObjectKey(input.key) || !isOwnedKey(input.kind, userId, input.key)) {
    return { ok: false, status: 403, error: 'You can only open files you uploaded.' };
  }

  const provider = selectStorageProvider(process.env);
  if (!provider) {
    return { ok: false, status: 503, error: 'Media storage is not configured on this deployment.' };
  }

  const rule = MEDIA_RULES[input.kind];
  const requestedTtl = Math.min(
    Math.max(Math.floor(input.expiresInSeconds ?? DEFAULT_PRIVATE_URL_TTL_SECONDS), 60),
    MAX_PRIVATE_URL_TTL_SECONDS,
  );

  if (rule.visibility === 'public') {
    if (provider === 'r2') {
      try {
        return {
          ok: true,
          data: {
            provider,
            url: r2ObjectUrl(input.key),
            visibility: 'public',
            expiresInSeconds: null,
          },
        };
      } catch (error) {
        logStorageError('R2 public URL', error instanceof Error ? error.message : 'unknown');
        return { ok: false, status: 503, error: 'Public media is not configured for this deployment.' };
      }
    }

    const storagePath = toSupabaseStoragePath(input.kind, userId, input.key);
    if (!storagePath) return { ok: false, status: 500, error: 'Could not build a safe storage path.' };
    const { data } = client.storage.from(rule.supabaseBucket).getPublicUrl(storagePath);
    return {
      ok: true,
      data: { provider, url: data.publicUrl, visibility: 'public', expiresInSeconds: null },
    };
  }

  try {
    if (provider === 'r2') {
      const url = await r2SignedDownloadUrl(input.key, requestedTtl);
      return {
        ok: true,
        data: { provider, url, visibility: 'private', expiresInSeconds: requestedTtl },
      };
    }

    // Owner-only for now. Recipient access (for example the other participant
    // in a conversation) must be granted by that domain's table, not by key
    // ownership; the messaging flow keeps its own participant-checked URLs.
    const storagePath = toSupabaseStoragePath(input.kind, userId, input.key);
    if (!storagePath) return { ok: false, status: 500, error: 'Could not build a safe storage path.' };
    const { data, error } = await client.storage
      .from(rule.supabaseBucket)
      .createSignedUrl(storagePath, requestedTtl);
    if (error || !data?.signedUrl) {
      logStorageError('Supabase signed download', error?.message ?? 'no signed URL returned');
      const mapped = mapStorageError(error?.message ?? '');
      return { ok: false, status: mapped.status, error: mapped.error };
    }
    return {
      ok: true,
      data: { provider, url: data.signedUrl, visibility: 'private', expiresInSeconds: requestedTtl },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signed URL failed.';
    logStorageError('signed download', message);
    return { ok: false, status: 502, error: 'Could not open that file. Please try again.' };
  }
}

export interface OrphanCleanupOptions {
  /**
   * Explicit keys must come from a trusted cleanup job. Only enable this after
   * checking the database references yourself.
   */
  readonly allowExplicitKeys?: boolean;
  /** When supplied, every explicit key must belong to this owner. */
  readonly ownerId?: string;
}

export interface OrphanCleanupResult {
  readonly deleted: string[];
  readonly failed: { key: string; error: string }[];
  readonly rejected: string[];
}

/**
 * Delete abandoned uploads. By default only `orphan/…` keys are accepted; a
 * job that has already verified database references may pass explicit keys.
 * No HTTP route exposes this helper, so it cannot be used to delete live media
 * by guessing a key.
 */
export async function deleteOrphanedR2Objects(
  keys: readonly string[],
  options: OrphanCleanupOptions = {},
): Promise<StorageActionResult<OrphanCleanupResult>> {
  if (!isR2Configured(process.env)) {
    return { ok: false, status: 503, error: 'Cloudflare R2 is not configured on this deployment.' };
  }
  if (!Array.isArray(keys) || keys.length > MAX_ORPHAN_DELETE_KEYS) {
    return { ok: false, status: 400, error: `Cleanup accepts at most ${MAX_ORPHAN_DELETE_KEYS} keys.` };
  }
  if (!keys.every((key) => typeof key === 'string')) {
    return { ok: false, status: 400, error: 'Every storage key must be a string.' };
  }

  const unique = [...new Set(keys)].filter(Boolean);
  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const key of unique) {
    const orphan = isOrphanObjectKey(key);
    const explicit =
      options.allowExplicitKeys === true &&
      isSafeObjectKey(key) &&
      (!options.ownerId ||
        MEDIA_KINDS.some((kind) => isOwnedKey(kind, options.ownerId as string, key)));
    if (orphan || explicit) accepted.push(key);
    else rejected.push(key);
  }

  if (accepted.length === 0) {
    return { ok: true, data: { deleted: [], failed: [], rejected } };
  }

  try {
    const result = await deleteR2Objects(accepted);
    return {
      ok: true,
      data: { deleted: result.deleted, failed: result.failed, rejected },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'R2 orphan cleanup failed.';
    logStorageError('R2 orphan cleanup', message);
    return { ok: false, status: 502, error: 'Could not clean up orphaned files.' };
  }
}
