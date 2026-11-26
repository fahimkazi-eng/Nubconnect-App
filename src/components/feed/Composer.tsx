'use client';

// Post composer for the real feed. Every supported type is written to the
// existing posts/post_media tables through the authorized storage route and an
// anon-key client; types the backend cannot represent are shown as disabled
// with the concrete reason. Nothing here creates demo or optimistic posts.
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Globe2,
  ImagePlus,
  Send,
  Users2,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar } from '@/components/ui/kit';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import {
  FEED_POST_TYPES,
  postTypeByKey,
  publishFeedPost,
  unavailableFeedPostTypes,
  type FeedPostAudience,
  type FeedPostTypeKey,
} from '@/lib/posts';

const CREATION_TYPES = FEED_POST_TYPES.filter((type) => type.available);
const UNAVAILABLE_TYPES = unavailableFeedPostTypes();

interface PhotoPreview {
  readonly file: File;
  readonly url: string;
}

export default function Composer() {
  const { user, isDemoUser, authLoading, refreshFeed, pushToast } = useApp();
  const [type, setType] = useState<FeedPostTypeKey>('text');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [audience, setAudience] = useState<FeedPostAudience>('university');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoPreview[]>([]);
  photosRef.current = photos;

  const definition = postTypeByKey(type)!;
  const universityId = user.primaryUniversityId;
  const canUseBackend = isBackendConfigured() && !isDemoUser && Boolean(universityId) && Boolean(user.id);

  // Local preview URLs belong to this composer only; release them on unmount.
  useEffect(
    () => () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    },
    [],
  );

  const clearPhotos = () => {
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    setPhotos([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const chooseType = (key: FeedPostTypeKey) => {
    const next = postTypeByKey(key);
    if (!next?.available) return;
    setType(key);
    setError(null);
    if (next.maxPhotos === 0 && photos.length > 0) clearPhotos();
    if (next.maxPhotos === 1 && photos.length > 1) {
      const [keep, ...extra] = photos;
      for (const photo of extra) URL.revokeObjectURL(photo.url);
      setPhotos(keep ? [keep] : []);
    }
    if (!next.supportsSourceUrl) setSourceUrl('');
  };

  const pickPhotos = (files: FileList | null) => {
    if (!files || definition.maxPhotos === 0) return;
    const room = definition.maxPhotos - photos.length;
    if (room <= 0) return;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (picked.length > 0) setPhotos((current) => [...current, ...picked]);
  };

  const removePhoto = (index: number) => {
    const target = photos[index];
    if (target) URL.revokeObjectURL(target.url);
    setPhotos((current) => current.filter((_, i) => i !== index));
    if (fileRef.current) fileRef.current.value = '';
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  };

  const publish = async () => {
    if (publishing) return;
    const client = getSupabaseBrowserClient();
    if (!client || !canUseBackend || !universityId) {
      setError('Sign in with a university-linked account to publish a real post.');
      return;
    }

    setPublishing(true);
    setError(null);
    const result = await publishFeedPost(client, {
      type,
      authorId: user.id,
      universityId,
      departmentId: user.departmentId ?? null,
      audience,
      body,
      title: definition.requiresTitle ? title : undefined,
      sourceUrl: definition.supportsSourceUrl ? sourceUrl : undefined,
      media: photos.map((photo) => photo.file),
    });
    setPublishing(false);

    if (result.error || !result.post) {
      const message = result.error ?? 'Could not publish that post.';
      setError(message);
      pushToast(message);
      return;
    }

    setBody('');
    setTitle('');
    setSourceUrl('');
    clearPhotos();
    pushToast('Posted to your campus feed', 'success');
    // The feed is loaded from the database; re-read it, never inject a local row.
    await refreshFeed();
  };

  const canSubmit =
    canUseBackend &&
    !publishing &&
    Boolean(body.trim()) &&
    (!definition.requiresTitle || Boolean(title.trim()));

  const titleLabel =
    type === 'question' ? 'Your question' : type === 'event_share' ? 'Event title' : 'Achievement title';

  return (
    <section className="card p-3 sm:p-4" aria-labelledby="composer-heading" aria-busy={publishing}>
      <div className="flex gap-3">
        <Avatar seed={user.id} name={user.name} size={40} />
        <div className="min-w-0 flex-1">
          <h2 id="composer-heading" className="font-display text-sm font-bold">
            Create a post
          </h2>

          <div
            className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Post type"
          >
            {CREATION_TYPES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => chooseType(option.key)}
                aria-pressed={type === option.key}
                disabled={publishing}
                className={`touch-target shrink-0 rounded-full px-3 text-xs font-bold ring-1 transition disabled:opacity-50 ${
                  type === option.key
                    ? 'bg-violet text-plum ring-violet'
                    : 'bg-campus-bg text-campus-text-sec ring-campus-border hover:text-violet-ink dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            {definition.description} Every post needs a caption — that is a database rule.
          </p>

          {definition.requiresTitle && (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={titleLabel}
              aria-label={titleLabel}
              maxLength={140}
              disabled={publishing}
              className="mt-2 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-sm outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev dark:text-campus-dark-text"
            />
          )}

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              type === 'question'
                ? 'Add the details students need to answer…'
                : type === 'event_share'
                  ? 'What is happening, when and where? Share verified details only.'
                  : type === 'achievement'
                    ? 'Who achieved what, and why it matters…'
                    : "What's happening in your campus life?"
            }
            rows={body.length > 90 ? 4 : 2}
            maxLength={4000}
            disabled={publishing}
            className="mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-campus-text-sec dark:placeholder:text-campus-dark-sec"
            aria-label="Post caption"
          />

          {definition.supportsSourceUrl && (
            <div className="mt-2">
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Source link (optional)"
                aria-label="Source link (optional)"
                inputMode="url"
                disabled={publishing}
                className="w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev dark:text-campus-dark-text"
              />
              <p className="mt-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                Shared events are student posts, not verified NUB announcements. Link the organiser when you can.
              </p>
            </div>
          )}

          {definition.maxPhotos > 0 && (
            <div className="mt-2">
              {photos.length > 0 && (
                <div className="mb-2 grid grid-cols-3 gap-1.5 rounded-xl bg-campus-bg p-1.5 dark:bg-campus-dark-card">
                  {photos.map((photo, index) => (
                    <div key={photo.url} className="group relative aspect-square overflow-hidden rounded-lg">
                      <img src={photo.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-gradient-to-t from-black/60 to-transparent p-0.5">
                        <button
                          type="button"
                          aria-label="Move photo left"
                          disabled={publishing || index === 0}
                          onClick={() => movePhoto(index, -1)}
                          className="hit-pad relative rounded p-0.5 text-white disabled:opacity-30"
                        >
                          <ArrowLeft size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove photo"
                          disabled={publishing}
                          onClick={() => removePhoto(index)}
                          className="hit-pad relative rounded p-0.5 text-white disabled:opacity-40"
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move photo right"
                          disabled={publishing || index === photos.length - 1}
                          onClick={() => movePhoto(index, 1)}
                          className="hit-pad relative rounded p-0.5 text-white disabled:opacity-30"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple={definition.maxPhotos > 1}
                className="hidden"
                onChange={(event) => {
                  pickPhotos(event.target.files);
                  event.target.value = '';
                }}
                aria-label="Add photos"
              />
              <p className="text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                JPEG, PNG or WebP, up to 10 MB each · {photos.length}/{definition.maxPhotos}
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as FeedPostAudience)}
                aria-label="Audience"
                disabled={publishing}
                className="touch-target appearance-none rounded-full bg-campus-bg pl-8 pr-6 text-xs font-semibold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                style={{ backgroundImage: 'none' }}
              >
                <option value="university">🌍 University</option>
                <option value="department">🎓 My Department</option>
                <option value="organization" disabled>
                  👥 My Circles (needs a real circle link)
                </option>
              </select>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec">
                {audience === 'university' ? <Globe2 size={15} /> : <Users2 size={15} />}
              </span>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec">
                <ChevronDown size={13} />
              </span>
            </div>
            {audience === 'department' && !user.departmentId && (
              <span className="text-[10px] font-semibold text-coral-ink dark:text-coral">
                No department is linked to your account yet.
              </span>
            )}
          </div>

          {authLoading && (
            <p role="status" className="mt-2 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              Checking your account…
            </p>
          )}
          {!authLoading && !canUseBackend && (
            <p role="status" className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Sign in with a university-linked account to publish a real post.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-coral-ink dark:text-coral">
              <AlertCircle size={13} className="mt-px shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <details className="mt-2 rounded-xl bg-campus-bg p-2 text-[11px] dark:bg-campus-dark-card">
            <summary className="cursor-pointer font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              Post types needing backend support
            </summary>
            <ul className="mt-2 space-y-1.5">
              {UNAVAILABLE_TYPES.map((option) => (
                <li key={option.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title={option.unavailableReason}
                    className="shrink-0 rounded-full bg-campus-card px-2 py-0.5 font-bold opacity-50 ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
                  >
                    {option.label} — Requires backend support
                  </button>
                  <span className="min-w-0 flex-1 text-campus-text-sec dark:text-campus-dark-sec">
                    {option.unavailableReason}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-campus-border pt-2.5 dark:border-campus-dark-border">
        {definition.maxPhotos > 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={publishing || photos.length >= definition.maxPhotos}
            className="touch-target flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-ink transition hover:bg-violet-soft disabled:opacity-40 dark:hover:bg-violet-dark-soft"
          >
            <ImagePlus size={16} />
            {definition.maxPhotos === 1 ? 'Photo' : 'Photos'}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => void publish()}
          disabled={!canSubmit}
          className="touch-target flex items-center gap-1.5 rounded-xl bg-violet px-4 py-1.5 text-xs font-bold text-plum shadow-violet-glow transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Send size={14} />
          {publishing ? 'Publishing…' : 'Post'}
        </button>
      </div>
      <div aria-live="polite" className="sr-only">
        {publishing ? 'Publishing your post to the campus feed' : ''}
      </div>
    </section>
  );
}
