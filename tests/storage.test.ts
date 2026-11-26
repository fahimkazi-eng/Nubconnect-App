// ============================================================================
// NUBCONNECT — media storage policy tests (PART 14).
// These cover the security boundary: type/size validation, safe names,
// traversal rejection, key ownership and provider selection.
// ============================================================================
import { describe, expect, it } from 'vitest';

import {
  MEDIA_KINDS,
  MEDIA_RULES,
  ORPHAN_KEY_PREFIX,
  buildObjectKey,
  canonicalMimeType,
  extensionForMime,
  isMediaKind,
  isOrphanObjectKey,
  isOwnedKey,
  isR2Configured,
  isSafeObjectKey,
  isStorageConfigured,
  isSupabaseStorageConfigured,
  safeFileBaseName,
  selectStorageProvider,
  toSupabaseStoragePath,
  validateMediaFile,
  type MediaKind,
  type StorageEnv,
} from '@/lib/storage/provider';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const RANDOM_ID = 'abc12345';
const FIXED_DATE = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));

const R2_ENV: StorageEnv = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_ACCESS_KEY_ID: 'access-key-id',
  R2_SECRET_ACCESS_KEY: 'secret-access-key-long-enough',
  R2_BUCKET: 'nub-connect-media',
};

const SUPABASE_ENV: StorageEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
};

describe('media rules', () => {
  it('covers every media kind exactly once', () => {
    expect(Object.keys(MEDIA_RULES).sort()).toEqual([...MEDIA_KINDS].sort());
    for (const kind of MEDIA_KINDS) {
      expect(MEDIA_RULES[kind].prefix.length).toBeGreaterThan(0);
      expect(MEDIA_RULES[kind].maxBytes).toBeGreaterThan(0);
      expect(MEDIA_RULES[kind].allowedMimeTypes.length).toBeGreaterThan(0);
    }
  });

  it('marks conversation attachments and documents private', () => {
    expect(MEDIA_RULES.message.visibility).toBe('private');
    expect(MEDIA_RULES.document.visibility).toBe('private');
    expect(MEDIA_RULES.avatar.visibility).toBe('public');
    expect(MEDIA_RULES.post.visibility).toBe('public');
  });

  it('requires a verified student for rooms, marketplace and documents', () => {
    expect(MEDIA_RULES.room.requiresVerifiedStudent).toBe(true);
    expect(MEDIA_RULES.marketplace.requiresVerifiedStudent).toBe(true);
    expect(MEDIA_RULES.document.requiresVerifiedStudent).toBe(true);
    expect(MEDIA_RULES.avatar.requiresVerifiedStudent).toBe(false);
  });
});

describe('validateMediaFile — type and size', () => {
  it('accepts a normal avatar and derives the extension from the MIME type', () => {
    const result = validateMediaFile('avatar', {
      fileName: 'My Campus Photo.PNG',
      mimeType: 'image/png',
      sizeBytes: 2 * 1024 * 1024,
    });
    expect(result).toEqual({ ok: true, safeName: 'my-campus-photo.png' });
  });

  it('ignores a dangerous user extension and uses the MIME extension', () => {
    const result = validateMediaFile('post', {
      fileName: 'holiday.exe',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result).toEqual({ ok: true, safeName: 'holiday.jpg' });
  });

  it('normalises the non-standard image/jpg alias', () => {
    expect(canonicalMimeType(' IMAGE/JPG ; charset=binary')).toBe('image/jpeg');
    const result = validateMediaFile('cover', {
      fileName: 'cover.jpeg',
      mimeType: 'image/jpg',
      sizeBytes: 1000,
    });
    expect(result).toEqual({ ok: true, safeName: 'cover.jpg' });
  });

  it('sanitises spaces, punctuation and non-ASCII names', () => {
    expect(safeFileBaseName('  Hello,   World!!  ')).toBe('hello-world');
    expect(safeFileBaseName('صورة')).toBe('upload');
    const result = validateMediaFile('story', {
      fileName: '  Hello, World!!.webp',
      mimeType: 'image/webp',
      sizeBytes: 1000,
    });
    expect(result).toEqual({ ok: true, safeName: 'hello-world.webp' });
  });

  it('rejects an unsupported MIME type', () => {
    const result = validateMediaFile('avatar', {
      fileName: 'anim.gif',
      mimeType: 'image/gif',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unsupported file type');
  });

  it('rejects a PDF disguised as an avatar', () => {
    const result = validateMediaFile('avatar', {
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts PDF documents and rejects executables', () => {
    const accepted = validateMediaFile('document', {
      fileName: 'transcript.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(accepted).toEqual({ ok: true, safeName: 'transcript.pdf' });

    const rejected = validateMediaFile('document', {
      fileName: 'installer.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 1024,
    });
    expect(rejected.ok).toBe(false);
  });

  it('rejects empty and non-integer sizes', () => {
    expect(
      validateMediaFile('post', { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 0 }).ok,
    ).toBe(false);
    expect(
      validateMediaFile('post', { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1.5 }).ok,
    ).toBe(false);
    expect(
      validateMediaFile('post', { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: -1 }).ok,
    ).toBe(false);
  });

  it('accepts the exact size limit and rejects one byte more', () => {
    const max = MEDIA_RULES.avatar.maxBytes;
    expect(
      validateMediaFile('avatar', {
        fileName: 'exact.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: max,
      }).ok,
    ).toBe(true);

    const tooLarge = validateMediaFile('avatar', {
      fileName: 'too-big.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: max + 1,
    });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.error).toContain('5 MB');
  });
});

describe('validateMediaFile — safe names and traversal', () => {
  it('rejects forward-slash path traversal', () => {
    const result = validateMediaFile('post', {
      fileName: '../../etc/passwd.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/path separators/i);
  });

  it('rejects backslash traversal used by Windows paths', () => {
    const result = validateMediaFile('post', {
      fileName: '..\\..\\windows\\system32\\evil.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects null bytes and control characters', () => {
    const result = validateMediaFile('post', {
      fileName: 'photo\u0000.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid characters/i);
  });

  it('rejects dot-prefixed and dot-dot file names', () => {
    expect(
      validateMediaFile('post', { fileName: '.env.jpg', mimeType: 'image/jpeg', sizeBytes: 1 }).ok,
    ).toBe(false);
    expect(
      validateMediaFile('post', { fileName: 'a..jpg', mimeType: 'image/jpeg', sizeBytes: 1 }).ok,
    ).toBe(false);
  });

  it('rejects an empty or missing file name', () => {
    expect(
      validateMediaFile('post', { fileName: '   ', mimeType: 'image/jpeg', sizeBytes: 1 }).ok,
    ).toBe(false);
    expect(
      validateMediaFile('post', {
        fileName: undefined as unknown as string,
        mimeType: 'image/jpeg',
        sizeBytes: 1,
      }).ok,
    ).toBe(false);
  });

  it('rejects an unknown kind at runtime', () => {
    const result = validateMediaFile('bogus' as MediaKind, {
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe('buildObjectKey', () => {
  it('builds a deterministic prefix/owner/year/month key', () => {
    const key = buildObjectKey('post', OWNER, 'campus.jpg', RANDOM_ID, FIXED_DATE);
    expect(key).toBe(`posts/${OWNER}/2026/01/${RANDOM_ID}-campus.jpg`);
  });

  it('pads the month and uses the UTC date', () => {
    const key = buildObjectKey(
      'story',
      OWNER,
      'night.png',
      RANDOM_ID,
      new Date('2026-12-31T23:30:00-05:00'),
    );
    // 2027-01-01T04:30Z — the key follows UTC, never the client timezone.
    expect(key).toBe(`stories/${OWNER}/2027/01/${RANDOM_ID}-night.png`);
  });

  it('refuses owner ids and random ids that could contain a path', () => {
    expect(() => buildObjectKey('post', '../admin', 'a.jpg', RANDOM_ID, FIXED_DATE)).toThrow();
    expect(() => buildObjectKey('post', OWNER, 'a.jpg', '../../id', FIXED_DATE)).toThrow();
    expect(() => buildObjectKey('post', OWNER, 'a.jpg', 'short', FIXED_DATE)).toThrow();
  });

  it('refuses an unsafe file name even when called directly', () => {
    expect(() => buildObjectKey('post', OWNER, '../evil.jpg', RANDOM_ID, FIXED_DATE)).toThrow();
    expect(() => buildObjectKey('post', OWNER, 'UPPER.jpg', RANDOM_ID, FIXED_DATE)).toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() => buildObjectKey('nope' as MediaKind, OWNER, 'a.jpg', RANDOM_ID, FIXED_DATE)).toThrow();
  });
});

describe('isOwnedKey and storage paths', () => {
  const key = buildObjectKey('post', OWNER, 'campus.jpg', RANDOM_ID, FIXED_DATE);

  it('accepts the owner’s own key for the matching kind', () => {
    expect(isOwnedKey('post', OWNER, key)).toBe(true);
  });

  it('rejects another student’s key', () => {
    expect(isOwnedKey('post', OTHER, key)).toBe(false);
  });

  it('rejects the same key under a different media kind', () => {
    expect(isOwnedKey('story', OWNER, key)).toBe(false);
  });

  it('rejects traversal and malformed dates', () => {
    expect(isOwnedKey('post', OWNER, `posts/${OWNER}/2026/01/../${RANDOM_ID}-a.jpg`)).toBe(false);
    expect(isOwnedKey('post', OWNER, `posts/${OWNER}/2026/13/${RANDOM_ID}-a.jpg`)).toBe(false);
    expect(isOwnedKey('post', OWNER, `posts/${OWNER}/26/01/${RANDOM_ID}-a.jpg`)).toBe(false);
    expect(isOwnedKey('post', '../admin', key)).toBe(false);
  });

  it('rejects extra path segments and a missing random id', () => {
    expect(isOwnedKey('post', OWNER, `${key}/extra`)).toBe(false);
    expect(isOwnedKey('post', OWNER, `posts/${OWNER}/2026/01/campus.jpg`)).toBe(false);
  });

  it('strips the kind prefix for Supabase bucket paths', () => {
    expect(toSupabaseStoragePath('post', OWNER, key)).toBe(
      `${OWNER}/2026/01/${RANDOM_ID}-campus.jpg`,
    );
    expect(toSupabaseStoragePath('post', OTHER, key)).toBeNull();
    expect(toSupabaseStoragePath('story', OWNER, key)).toBeNull();
  });
});

describe('safe object keys', () => {
  it('accepts normal nested keys', () => {
    expect(isSafeObjectKey('posts/owner/2026/01/id-file.jpg')).toBe(true);
    expect(isSafeObjectKey('orphan/2026/01/file.jpg')).toBe(true);
  });

  it('rejects traversal, backslashes and empty segments', () => {
    expect(isSafeObjectKey('../file.jpg')).toBe(false);
    expect(isSafeObjectKey('posts/../file.jpg')).toBe(false);
    expect(isSafeObjectKey('posts\\file.jpg')).toBe(false);
    expect(isSafeObjectKey('/posts/file.jpg')).toBe(false);
    expect(isSafeObjectKey('posts//file.jpg')).toBe(false);
    expect(isSafeObjectKey('')).toBe(false);
  });
});

describe('orphan cleanup guards', () => {
  it('only recognises the dedicated orphan prefix', () => {
    expect(isOrphanObjectKey(`${ORPHAN_KEY_PREFIX}2026/01/file.jpg`)).toBe(true);
    expect(isOrphanObjectKey('posts/owner/2026/01/file.jpg')).toBe(false);
    expect(isOrphanObjectKey(ORPHAN_KEY_PREFIX)).toBe(false);
    expect(isOrphanObjectKey('orphan/../file.jpg')).toBe(false);
  });
});

describe('MIME helpers', () => {
  it('maps supported MIME types to extensions', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('image/webp')).toBe('webp');
    expect(extensionForMime('application/pdf')).toBe('pdf');
    expect(extensionForMime('image/gif')).toBeNull();
  });

  it('recognises media kinds', () => {
    expect(isMediaKind('avatar')).toBe(true);
    expect(isMediaKind('message')).toBe(true);
    expect(isMediaKind('admin')).toBe(false);
    expect(isMediaKind(null)).toBe(false);
  });
});

describe('environment and provider selection', () => {
  it('detects a fully configured R2 deployment', () => {
    expect(isR2Configured(R2_ENV)).toBe(true);
  });

  it('is opt-in: a missing secret disables R2', () => {
    const partial: StorageEnv = { ...R2_ENV, R2_SECRET_ACCESS_KEY: '' };
    expect(isR2Configured(partial)).toBe(false);
  });

  it('rejects placeholder R2 values', () => {
    expect(isR2Configured({ ...R2_ENV, R2_ACCOUNT_ID: 'your-account-id' })).toBe(false);
    expect(isR2Configured({ ...R2_ENV, R2_BUCKET: 'your-bucket' })).toBe(false);
    expect(isR2Configured({ ...R2_ENV, R2_SECRET_ACCESS_KEY: 'replace-me' })).toBe(false);
  });

  it('rejects a malformed account id or bucket', () => {
    expect(isR2Configured({ ...R2_ENV, R2_ACCOUNT_ID: 'not-an-account' })).toBe(false);
    expect(isR2Configured({ ...R2_ENV, R2_BUCKET: 'Bad_Bucket' })).toBe(false);
  });

  it('detects Supabase Storage as the fallback', () => {
    expect(isSupabaseStorageConfigured(SUPABASE_ENV)).toBe(true);
    expect(isSupabaseStorageConfigured({ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost' })).toBe(false);
    expect(
      isSupabaseStorageConfigured({
        NEXT_PUBLIC_SUPABASE_URL: 'https://your-project-id.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop',
      }),
    ).toBe(false);
  });

  it('prefers R2, falls back to Supabase and reports an unconfigured deployment', () => {
    expect(selectStorageProvider({ ...R2_ENV, ...SUPABASE_ENV })).toBe('r2');
    expect(selectStorageProvider(SUPABASE_ENV)).toBe('supabase');
    expect(selectStorageProvider({})).toBeNull();
    expect(selectStorageProvider({ ...R2_ENV, R2_BUCKET: '' })).toBeNull();
  });

  it('reports whether any storage provider is usable', () => {
    expect(isStorageConfigured(R2_ENV)).toBe(true);
    expect(isStorageConfigured(SUPABASE_ENV)).toBe(true);
    expect(isStorageConfigured({})).toBe(false);
  });
});
