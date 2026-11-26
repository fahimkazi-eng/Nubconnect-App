// ============================================================================
// NUBCONNECT — Cloudflare R2 adapter (server only).
//
// The S3 client is created lazily from server-side env vars. No value from
// this file may ever be imported by a client component: `server-only` turns
// such an import into a build error instead of a leaked credential.
// ============================================================================
import 'server-only';

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PRIVATE_MEDIA_CACHE_CONTROL,
  isR2Configured,
  isSafeObjectKey,
} from './provider';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const MIN_URL_TTL_SECONDS = 60;
const MAX_UPLOAD_TTL_SECONDS = 60 * 60;
const MAX_DOWNLOAD_TTL_SECONDS = 60 * 60;
const DELETE_BATCH_SIZE = 1000;

function readR2Config(): R2Config {
  if (!isR2Configured(process.env)) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET on the server.',
    );
  }

  return {
    accountId: (process.env.R2_ACCOUNT_ID ?? '').trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY ?? '').trim(),
    bucket: (process.env.R2_BUCKET ?? '').trim(),
  };
}

// A module-level singleton survives warm serverless invocations. It is keyed by
// the non-secret config so a test or a config reload cannot reuse a stale client.
let cachedClient: { fingerprint: string; client: S3Client } | null = null;

function getR2Client(config: R2Config): S3Client {
  const fingerprint = `${config.accountId}:${config.accessKeyId}:${config.bucket}`;
  if (cachedClient?.fingerprint === fingerprint) return cachedClient.client;

  const client = new S3Client({
    // R2 accepts `auto` as the region for the S3-compatible API.
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Newer SDKs add checksum query parameters that a browser PUT cannot
    // satisfy. Presigned uploads only need SigV4, not the default CRC32.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  cachedClient = { fingerprint, client };
  return client;
}

function clampTtl(seconds: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(seconds)) return fallback;
  return Math.min(Math.max(Math.floor(seconds as number), MIN_URL_TTL_SECONDS), max);
}

export interface R2UploadUrlInput {
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly cacheControl?: string;
  readonly expiresInSeconds?: number;
}

export interface R2UploadUrl {
  readonly uploadUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresInSeconds: number;
}

/**
 * Create a short-lived presigned PUT.
 *
 * Content-Type, Content-Length and Cache-Control are part of the signed
 * request, so a client cannot upload a different type or size than the one the
 * server approved. A presigned PUT cannot be used for a GET or a LIST.
 */
export async function createR2UploadUrl(input: R2UploadUrlInput): Promise<R2UploadUrl> {
  if (!isSafeObjectKey(input.key)) throw new Error('Refusing to presign an unsafe object key.');
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error('A positive integer file size is required to presign an upload.');
  }

  const config = readR2Config();
  const expiresInSeconds = clampTtl(input.expiresInSeconds, 5 * 60, MAX_UPLOAD_TTL_SECONDS);
  const cacheControl = input.cacheControl ?? PRIVATE_MEDIA_CACHE_CONTROL;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    CacheControl: cacheControl,
  });

  const uploadUrl = await getSignedUrl(getR2Client(config), command, {
    expiresIn: expiresInSeconds,
    // The S3 presigner marks content-type as unsignable by default. Opting it
    // (and the cache policy) back in makes the URL reject a different type or
    // cache header, not just a different byte count.
    signableHeaders: new Set(['content-type', 'cache-control']),
  });

  return {
    uploadUrl,
    headers: {
      'Content-Type': input.contentType,
      'Cache-Control': cacheControl,
      'Content-Length': String(input.sizeBytes),
    },
    expiresInSeconds,
  };
}

export interface R2DeleteResult {
  readonly deleted: string[];
  readonly failed: { key: string; error: string }[];
}

/** Delete up to any number of keys in S3/R2 batches. Missing keys succeed. */
export async function deleteR2Objects(keys: readonly string[]): Promise<R2DeleteResult> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return { deleted: [], failed: [] };
  if (!unique.every(isSafeObjectKey)) {
    throw new Error('Refusing to delete an unsafe object key.');
  }

  const config = readR2Config();
  const client = getR2Client(config);
  const deleted: string[] = [];
  const failed: { key: string; error: string }[] = [];

  for (let index = 0; index < unique.length; index += DELETE_BATCH_SIZE) {
    const batch = unique.slice(index, index + DELETE_BATCH_SIZE);
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );

    const errors = response.Errors ?? [];
    const failedKeys = new Set(errors.map((entry) => entry.Key).filter(Boolean));
    const batchFailed = errors.map((entry) => ({
      key: entry.Key ?? '',
      error: entry.Message ?? entry.Code ?? 'Delete failed.',
    }));

    failed.push(...batchFailed);
    deleted.push(...batch.filter((key) => !failedKeys.has(key)));
  }

  return { deleted, failed };
}

function publicBaseUrl(): string {
  const base = (process.env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL is not configured; public R2 objects have no URL.');
  }
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('R2_PUBLIC_BASE_URL must be an absolute http(s) URL.');
  }
  return base;
}

/** Public CDN URL for an object in a bucket exposed through a custom domain. */
export function r2ObjectUrl(key: string): string {
  if (!isSafeObjectKey(key)) throw new Error('Refusing to build a URL for an unsafe object key.');
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${publicBaseUrl()}/${encoded}`;
}

/** Private assets are only ever exposed through a short-lived signed GET. */
export async function r2SignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 10 * 60,
): Promise<string> {
  if (!isSafeObjectKey(key)) throw new Error('Refusing to sign an unsafe object key.');

  const config = readR2Config();
  const ttl = clampTtl(expiresInSeconds, 10 * 60, MAX_DOWNLOAD_TTL_SECONDS);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ResponseCacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
  });

  return getSignedUrl(getR2Client(config), command, { expiresIn: ttl });
}
