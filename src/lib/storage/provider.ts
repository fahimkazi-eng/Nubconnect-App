// ============================================================================
// NUBCONNECT — Media storage policy (pure, unit-tested).
//
// Every upload decision that can be made without a database or a network call
// lives here: which types and sizes are allowed per media kind, whether the
// asset is public or private, how the object key is built and how ownership is
// checked. Server adapters (R2, Supabase) and the API routes consume these
// helpers so the browser can never invent its own path or extension.
//
// Environment values are always passed in. Reading process.env here would make
// the module untestable and could accidentally pull a secret into the browser.
// ============================================================================

export const MEDIA_KINDS = [
  'avatar',
  'cover',
  'post',
  'story',
  'community',
  'event',
  'room',
  'marketplace',
  'message',
  'document',
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaVisibility = 'public' | 'private';

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && (MEDIA_KINDS as readonly string[]).includes(value);
}

export interface MediaRule {
  /** Canonical MIME types accepted for this kind. */
  readonly allowedMimeTypes: readonly string[];
  readonly maxBytes: number;
  readonly visibility: MediaVisibility;
  /** First path segment of the object key. */
  readonly prefix: string;
  /** Existing Supabase bucket used when R2 is not configured. */
  readonly supabaseBucket: string;
  /** A student must have a linked university to upload this kind. */
  readonly requiresUniversity: boolean;
  /** A student must have passed staff review (NUB Verified) for this kind. */
  readonly requiresVerifiedStudent: boolean;
}

const MB = 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const MEDIA_RULES: Readonly<Record<MediaKind, MediaRule>> = Object.freeze({
  avatar: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 5 * MB,
    visibility: 'public',
    prefix: 'avatars',
    supabaseBucket: 'avatars',
    requiresUniversity: false,
    requiresVerifiedStudent: false,
  },
  cover: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    prefix: 'covers',
    supabaseBucket: 'covers',
    requiresUniversity: false,
    requiresVerifiedStudent: false,
  },
  post: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 10 * MB,
    visibility: 'public',
    prefix: 'posts',
    supabaseBucket: 'post-media',
    requiresUniversity: true,
    requiresVerifiedStudent: false,
  },
  story: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 10 * MB,
    visibility: 'public',
    prefix: 'stories',
    supabaseBucket: 'story-media',
    requiresUniversity: true,
    requiresVerifiedStudent: false,
  },
  community: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    prefix: 'communities',
    supabaseBucket: 'community-media',
    requiresUniversity: true,
    requiresVerifiedStudent: false,
  },
  event: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 8 * MB,
    visibility: 'public',
    prefix: 'events',
    supabaseBucket: 'event-media',
    requiresUniversity: true,
    requiresVerifiedStudent: false,
  },
  room: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 10 * MB,
    visibility: 'public',
    prefix: 'rooms',
    supabaseBucket: 'room-media',
    requiresUniversity: true,
    requiresVerifiedStudent: true,
  },
  marketplace: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 10 * MB,
    visibility: 'public',
    prefix: 'marketplace',
    supabaseBucket: 'marketplace-media',
    requiresUniversity: true,
    requiresVerifiedStudent: true,
  },
  message: {
    allowedMimeTypes: PHOTO_TYPES,
    maxBytes: 8 * MB,
    // Conversation attachments are only ever handed out as short-lived URLs.
    visibility: 'private',
    prefix: 'messages',
    supabaseBucket: 'message-photos',
    requiresUniversity: false,
    requiresVerifiedStudent: false,
  },
  document: {
    allowedMimeTypes: DOCUMENT_TYPES,
    maxBytes: 20 * MB,
    visibility: 'private',
    prefix: 'documents',
    supabaseBucket: 'documents',
    requiresUniversity: true,
    requiresVerifiedStudent: true,
  },
});

export function getMediaRule(kind: MediaKind): MediaRule {
  return MEDIA_RULES[kind];
}

/** Public objects are immutable because a new key is generated for every upload. */
export const PUBLIC_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';
/** Private objects must never be cached by a shared proxy or the browser. */
export const PRIVATE_MEDIA_CACHE_CONTROL = 'private, no-store, max-age=0';

export function cacheControlFor(visibility: MediaVisibility): string {
  return visibility === 'public' ? PUBLIC_MEDIA_CACHE_CONTROL : PRIVATE_MEDIA_CACHE_CONTROL;
}

/* --- File type + size validation ------------------------------------------ */

const MIME_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
});

const MIME_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
});

export interface MediaFileInput {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly fileName: string;
}

export type MediaValidationResult =
  | { readonly ok: true; readonly safeName: string }
  | { readonly ok: false; readonly error: string };

/** `image/jpg` is a common (non-standard) browser alias for `image/jpeg`. */
export function canonicalMimeType(mimeType: string): string {
  const base = (mimeType.split(';')[0] ?? '').trim().toLowerCase();
  return base === 'image/jpg' ? 'image/jpeg' : base;
}

export function extensionForMime(mimeType: string): string | null {
  return MIME_EXTENSIONS[canonicalMimeType(mimeType)] ?? null;
}

function describeMaxBytes(bytes: number): string {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function describeAllowedTypes(types: readonly string[]): string {
  return types.map((type) => MIME_LABELS[type] ?? type).join(', ');
}

/**
 * Convert a user-supplied name into a URL-safe base name.
 * The extension is deliberately dropped: it is derived from the validated MIME
 * type, so `photo.exe` with `image/jpeg` becomes `photo.jpg`, never an executable.
 */
export function safeFileBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]*$/, '');
  const normalized = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'upload';
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Validate a client-declared file before any upload URL is issued.
 * Size is validated again by the presigned PUT (Content-Length) and by the
 * bucket, because a client can lie before it uploads.
 */
export function validateMediaFile(kind: MediaKind, input: MediaFileInput): MediaValidationResult {
  const rule = MEDIA_RULES[kind];
  if (!rule) return { ok: false, error: 'Unsupported media kind.' };

  const mimeType = canonicalMimeType(input.mimeType);
  if (!mimeType || !rule.allowedMimeTypes.includes(mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type. Use ${describeAllowedTypes(rule.allowedMimeTypes)}.`,
    };
  }

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'The selected file is empty or has an invalid size.' };
  }
  if (input.sizeBytes > rule.maxBytes) {
    return {
      ok: false,
      error: `That file is too large. The maximum size is ${describeMaxBytes(rule.maxBytes)}.`,
    };
  }

  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';
  if (!fileName) return { ok: false, error: 'Choose a file with a valid name.' };
  if (fileName.length > 255) return { ok: false, error: 'That file name is too long.' };
  if (CONTROL_CHARACTERS.test(fileName)) {
    return { ok: false, error: 'That file name contains invalid characters.' };
  }

  // Path separators, traversal segments and hidden-file names are rejected
  // rather than silently rewritten: a traversal attempt is not a typo.
  if (fileName.includes('/') || fileName.includes('\\')) {
    return { ok: false, error: 'File names cannot contain path separators.' };
  }
  if (fileName.includes('..')) {
    return { ok: false, error: 'File names cannot contain path traversal sequences.' };
  }
  if (fileName.startsWith('.')) {
    return { ok: false, error: 'File names cannot start with a dot.' };
  }

  const extension = extensionForMime(mimeType);
  if (!extension) {
    return { ok: false, error: 'Unsupported file type.' };
  }

  return { ok: true, safeName: `${safeFileBaseName(fileName)}.${extension}` };
}

/* --- Object keys + ownership ---------------------------------------------- */

const OWNER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const RANDOM_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const SAFE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,100}$/;
const OBJECT_KEY_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export function isValidOwnerId(ownerId: string): boolean {
  return OWNER_ID_PATTERN.test(ownerId);
}

/**
 * Reject keys that could escape their prefix when handed to an object store.
 * This is used before every presign/delete call, even for keys that came from
 * our own database.
 */
export function isSafeObjectKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (key.startsWith('/') || key.includes('\\') || key.includes('//')) return false;
  if (!OBJECT_KEY_PATTERN.test(key)) return false;
  return !key.split('/').some((part) => part.length === 0 || part === '.' || part === '..');
}

/**
 * Build `<prefix>/<ownerId>/<yyyy>/<mm>/<randomId>-<safeName>`.
 *
 * Throws instead of returning an unsafe key: every argument is expected to be
 * produced by validated server code, so a bad argument is a programming error.
 */
export function buildObjectKey(
  kind: MediaKind,
  ownerId: string,
  safeName: string,
  randomId: string,
  now: Date = new Date(),
): string {
  const rule = MEDIA_RULES[kind];
  if (!rule) throw new Error(`Unknown media kind: ${String(kind)}`);
  if (!isValidOwnerId(ownerId)) throw new Error('Invalid storage owner id.');
  if (!RANDOM_ID_PATTERN.test(randomId)) throw new Error('Invalid storage random id.');
  if (!SAFE_NAME_PATTERN.test(safeName) || safeName.includes('..')) {
    throw new Error('Invalid safe file name.');
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${rule.prefix}/${ownerId}/${year}/${month}/${randomId}-${safeName}`;
}

/**
 * Ownership is part of the key, not a separate database lookup, so a caller
 * cannot delete or sign somebody else's object by guessing a key.
 */
export function isOwnedKey(kind: MediaKind, ownerId: string, key: string): boolean {
  const rule = MEDIA_RULES[kind];
  if (!rule || !isValidOwnerId(ownerId) || !isSafeObjectKey(key)) return false;

  const parts = key.split('/');
  if (parts.length !== 5) return false;

  const [prefix, keyOwner, year, month, file] = parts as [string, string, string, string, string];
  if (prefix !== rule.prefix || keyOwner !== ownerId) return false;
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) return false;
  if (!/^[A-Za-z0-9_-]{8,64}-[a-z0-9][a-z0-9._-]{0,100}$/.test(file)) return false;
  return true;
}

/**
 * Supabase buckets already scope objects by owner at the first folder
 * (`<uid>/…` and `<conversation>/<uid>/…`), so the kind prefix is dropped from
 * the bucket-relative path. R2 keeps the full canonical key.
 */
export function toSupabaseStoragePath(kind: MediaKind, ownerId: string, key: string): string | null {
  const rule = MEDIA_RULES[kind];
  if (!rule || !isOwnedKey(kind, ownerId, key)) return null;
  return key.slice(rule.prefix.length + 1);
}

/** Cleanup jobs may only touch the dedicated orphan area, never live media. */
export const ORPHAN_KEY_PREFIX = 'orphan/';

export function isOrphanObjectKey(key: string): boolean {
  return isSafeObjectKey(key) && key.startsWith(ORPHAN_KEY_PREFIX) && key.length > ORPHAN_KEY_PREFIX.length;
}

/* --- Environment / provider selection ------------------------------------- */

export type StorageEnv = Readonly<Record<string, string | undefined>>;
export type StorageProvider = 'r2' | 'supabase';

function configuredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(your[-_]|replace|changeme|example|placeholder)/i.test(trimmed)) return null;
  return trimmed;
}

/** R2 is strictly opt-in: all four server-only values must be present. */
export function isR2Configured(env: StorageEnv): boolean {
  const accountId = configuredValue(env.R2_ACCOUNT_ID);
  const accessKeyId = configuredValue(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = configuredValue(env.R2_SECRET_ACCESS_KEY);
  const bucket = configuredValue(env.R2_BUCKET);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return false;
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return false;
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) return false;
  return secretAccessKey.length >= 16;
}

export function isSupabaseStorageConfigured(env: StorageEnv): boolean {
  const url = configuredValue(env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = configuredValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return false;
  if (url.includes('your-project-id')) return false;
  return url.startsWith('https://') && anonKey.length > 20;
}

export function isStorageConfigured(env: StorageEnv): boolean {
  return isR2Configured(env) || isSupabaseStorageConfigured(env);
}

/** R2 wins when configured; Supabase Storage is the secure fallback. */
export function selectStorageProvider(env: StorageEnv): StorageProvider | null {
  if (isR2Configured(env)) return 'r2';
  if (isSupabaseStorageConfigured(env)) return 'supabase';
  return null;
}
