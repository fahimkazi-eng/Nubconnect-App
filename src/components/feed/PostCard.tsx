'use client';

// Social post card: author identity, audience, photos (grid + viewer),
// reactions with picker, comments with replies/edit/delete, save, share,
// and full feed controls (hide / mute / unfollow / show less / report).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  ChevronDown,
  CornerDownRight,
  Flag,
  Globe2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share2,
  Smile,
  Trash2,
  UserMinus,
  Users2,
  VolumeX,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import type { Post, ReactionType } from '@/lib/types';
import { useApp } from '@/lib/store';
import { isBackendConfigured } from '@/lib/supabase';
import { Avatar, AnimatedCount, DemoTag, Lightbox, PhotoGrid, VerifiedBadge } from '@/components/ui/kit';
import { timeAgo } from '@/lib/format';
import {
  QUICK_REACTION,
  REACTION_CATALOG,
  activeReactions,
  contextActionForPost,
  reactionDef,
} from '@/lib/reactions';

/** Press-and-hold delay before the reaction selector opens (ms). */
const HOLD_MS = 380;

export default function PostCard({ post }: { post: Post }) {
  const app = useApp();
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  /** Emoji burst floating off the react button when a reaction lands. */
  const [burst, setBurst] = useState<{ id: number; emoji: string } | null>(null);
  /** Which comment (id) has its reaction chips open. */
  const [commentPicker, setCommentPicker] = useState<string | null>(null);

  const holdTimer = useRef<number | null>(null);
  const didHold = useRef(false);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 750);
    return () => clearTimeout(t);
  }, [burst]);

  const chips = activeReactions(post.reactions);
  const total = chips.reduce((sum, c) => sum + c.count, 0);
  const ctxAction = contextActionForPost(post);
  // A post published by a Page belongs to that Page, not to a student. Real
  // student posts have no demo identity to link to, so we never invent one.
  const publisher = post.publisher ?? null;
  const profileHref = publisher ? `/page/${publisher.slug}` : null;

  const react = (r: ReactionType) => {
    app.react(post.id, r);
    setShowPicker(false);
    setBurst({ id: Date.now(), emoji: reactionDef(r).emoji });
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
  };

  /* Tap = quick reaction; press-and-hold (or the chevron) = full selector. */
  const startHold = () => {
    didHold.current = false;
    holdTimer.current = window.setTimeout(() => {
      didHold.current = true;
      setShowPicker(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    }, HOLD_MS);
  };
  const endHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  useEffect(() => endHold, []);

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'NUBCONNECT post', text: post.body.slice(0, 80), url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      app.pushToast('Link copied to clipboard', 'success');
    } catch {
      app.pushToast('Could not share this post');
    }
  };

  return (
    <article className="card overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 pb-2 sm:p-4 sm:pb-2">
        {profileHref ? (
          <Link href={profileHref} aria-label={post.authorName}>
            <Avatar
              seed={post.authorId}
              name={post.authorName}
              size={42}
              src={publisher ? publisher.avatarUrl ?? null : undefined}
            />
          </Link>
        ) : (
          <Avatar
            seed={post.authorId}
            name={post.authorName}
            size={42}
            src={publisher ? publisher.avatarUrl ?? null : undefined}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            {profileHref ? (
              <Link href={profileHref} className="font-display text-sm font-bold hover:underline">
                {post.authorName}
              </Link>
            ) : (
              <span className="font-display text-sm font-bold">{post.authorName}</span>
            )}
            {publisher && (
              <VerifiedBadge
                label={
                  publisher.verificationStatus === 'officially_verified'
                    ? 'Verified page'
                    : 'Page'
                }
              />
            )}
            {post.originBadge === 'Official University Info' && !publisher && (
              <VerifiedBadge label="Official" />
            )}
            {post.isDemo && <DemoTag compact />}
          </div>
          <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            {post.authorRole} • {timeAgo(post.createdAt)} •{' '}
            {post.audience === 'University' ? (
              <Globe2 size={10} className="inline" aria-label="University audience" />
            ) : (
              <Users2 size={10} className="inline" aria-label={`${post.audience} audience`} />
            )}
          </p>
        </div>
        <div className="relative">
          <button
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="touch-target flex items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
              <div role="menu" className="glass-strong absolute right-0 top-11 z-20 w-56 animate-pop overflow-hidden rounded-2xl p-1 text-sm">
                {isBackendConfigured() && (
                  <p className="px-3 py-1.5 text-[10px] font-semibold leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                    These feed controls last for this session only.
                  </p>
                )}
                <button role="menuitem" onClick={() => { app.hidePost(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
                  <EyeOff size={15} /> Hide post
                </button>
                <button role="menuitem" onClick={() => { app.muteAccount(post.authorId); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
                  <VolumeX size={15} /> Mute this account
                </button>
                {post.authorId !== app.user.id && app.isFollowing(post.authorId) && (
                  <button role="menuitem" onClick={() => { app.toggleFollow(post.authorId); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
                    <UserMinus size={15} /> Unfollow
                  </button>
                )}
                <button role="menuitem" onClick={() => { app.showLessLikeThis(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
                  <Sparkles size={15} /> Show less like this
                </button>
                <button role="menuitem" onClick={() => { app.toggleSavePost(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
                  <Bookmark size={15} /> {post.saved ? 'Remove from Saved' : 'Save post'}
                </button>
                <button role="menuitem" onClick={() => { app.reportContent('this post', { targetType: 'post', targetId: post.id, reason: 'spam' }); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium text-coral-ink hover:bg-coral-soft dark:text-coral dark:hover:bg-coral/10">
                  <Flag size={15} /> Report post
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editorial hairline separates the byline from the story. */}
      <div className="editorial-rule mx-3 text-violet-ink dark:text-violet sm:mx-4" />

      {/* Type, headline and provenance — all fields that really exist on posts. */}
      {(post.title || post.category || post.sourceUrl) && (
        <div className="px-3 pb-2 sm:px-4">
          <p className="editorial-kicker mb-1 text-violet-ink dark:text-violet">
            {post.category ? `Campus dispatch / ${post.category}` : 'Campus dispatch'}
          </p>
          {post.title && (
            <h3 className="font-editorial text-[23px] leading-[1.15] text-editorial-ink dark:text-campus-dark-text">
              {post.title}
            </h3>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
            {post.category === 'Event sharing' && !publisher && (
              <span>Student-shared — check the organiser for details</span>
            )}
            {post.sourceUrl && (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-violet-ink hover:underline dark:text-violet"
              >
                Source ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {post.body && (
        <p className="whitespace-pre-wrap px-3 pb-3 text-[14.5px] leading-relaxed sm:px-4">
          {post.body}
        </p>
      )}

      {/* Photos */}
      {post.media.length > 0 && (
        <div className="px-3 pb-2 sm:px-4">
          <PhotoGrid photos={post.media} onOpen={setLightbox} />
        </div>
      )}

      {/* Counts — per-type chips (tap a chip to send that reaction) */}
      {(chips.length > 0 || post.comments.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 text-[12px] text-campus-text-sec dark:text-campus-dark-sec sm:px-4">
          <span className="flex flex-wrap items-center gap-1">
            {chips.map(({ def, count }) => (
              <button
                key={def.key}
                onClick={() => react(def.key)}
                aria-pressed={post.myReaction === def.key}
                aria-label={`${def.label} — ${count}. Tap to toggle`}
                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition active:scale-90 ${
                  post.myReaction === def.key
                    ? 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet'
                    : 'bg-campus-bg text-campus-text-sec hover:bg-violet-soft dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft'
                }`}
              >
                <span aria-hidden="true">{def.emoji}</span>
                <AnimatedCount value={count} />
              </button>
            ))}
            {total > 0 && chips.length === 0 && (
              <span aria-label={`${total} reactions`}>
                <AnimatedCount value={total} /> reactions
              </span>
            )}
          </span>
          {post.comments.length > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="hover:underline">
              {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {/* Contextual action — one meaningful response for this content kind */}
      {ctxAction && (
        <div className="px-3 pb-1.5 sm:px-4">
          <button
            onClick={() => app.toggleContextAction(post.id)}
            aria-pressed={post.myContextAction}
            className={`touch-target flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition active:scale-[0.98] ${
              post.myContextAction
                ? 'border-violet bg-violet-soft text-violet-ink dark:border-violet dark:bg-violet-dark-soft dark:text-violet'
                : 'border-campus-border bg-campus-card text-campus-text-sec hover:border-violet hover:text-violet-ink dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:hover:border-violet dark:hover:text-violet'
            }`}
          >
            <span aria-hidden="true">{ctxAction.emoji}</span>
            {post.myContextAction ? ctxAction.activeLabel : ctxAction.label}
          </button>
          {isBackendConfigured() && (
            <p className="mt-1 text-center text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              Saved on this device for this session only.
            </p>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="mx-3 mb-1 grid grid-cols-4 gap-1 border-t border-campus-border pt-1 dark:border-campus-dark-border sm:mx-4">
        <div className="relative flex items-center">
          {burst && (
            <span
              key={burst.id}
              aria-hidden="true"
              className="animate-reaction-burst pointer-events-none absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-2xl"
            >
              {burst.emoji}
            </span>
          )}
          <button
            onClick={() => {
              if (!didHold.current) react(QUICK_REACTION);
            }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => {
              e.preventDefault();
              endHold();
              setShowPicker(true);
            }}
            aria-label={
              post.myReaction
                ? `Reacted ${reactionDef(post.myReaction).label} — tap to remove, hold for all reactions`
                : 'React — tap for Love, hold for all reactions'
            }
            className={`touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
              post.myReaction
                ? 'text-violet-ink'
                : 'text-campus-text-sec hover:bg-violet-soft dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft'
            }`}
          >
            {post.myReaction ? reactionDef(post.myReaction).emoji : <Smile size={17} />}
            {post.myReaction ? reactionDef(post.myReaction).label : 'React'}
          </button>
          <button
            aria-label="More reactions"
            aria-expanded={showPicker}
            onClick={() => setShowPicker(!showPicker)}
            className="touch-target flex items-center justify-center rounded-xl text-campus-text-sec hover:bg-violet-soft dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowComments(true)}
            className="touch-target flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-campus-text-sec transition hover:bg-violet-soft active:scale-95 dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft"
            aria-label="Comment"
          >
            <MessageSquare size={17} />
            Comment
          </button>
        </div>

        <button
          onClick={share}
          className="touch-target flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-campus-text-sec transition hover:bg-violet-soft active:scale-95 dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft"
          aria-label="Share"
        >
          <Share2 size={17} />
          Share
        </button>

        <button
          onClick={() => app.toggleSavePost(post.id)}
          aria-pressed={post.saved}
          className={`touch-target flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
            post.saved
              ? 'text-violet-ink'
              : 'text-campus-text-sec hover:bg-violet-soft dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft'
          }`}
          aria-label={post.saved ? 'Saved' : 'Save'}
        >
          <Bookmark size={17} className={post.saved ? 'fill-current' : ''} />
          {post.saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Reaction picker — the universal set (§8) */}
      {showPicker && (
        <div className="relative">
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setShowPicker(false)} />
          <div className="glass-strong absolute bottom-2 left-3 z-20 flex animate-pop gap-1 rounded-full p-1.5 sm:left-4">
            {REACTION_CATALOG.map((r) => (
              <button
                key={r.key}
                onClick={() => react(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`touch-target flex items-center justify-center rounded-full text-xl transition hover:scale-125 ${
                  post.myReaction === r.key ? 'bg-violet-soft dark:bg-violet-dark-soft' : ''
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="space-y-2 border-t border-campus-border bg-campus-bg/60 px-3 py-3 dark:border-campus-dark-border dark:bg-campus-dark-card/40 sm:px-4">
          {post.comments.map((c) => (
            <div key={c.id}>
              {editing === c.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-campus-border bg-white px-3 py-1.5 text-xs outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev dark:text-campus-dark-text"
                    aria-label="Edit comment"
                  />
                  <button
                    onClick={() => {
                      app.editComment(post.id, c.id, editText.trim());
                      setEditing(null);
                    }}
                    className="rounded-lg bg-violet px-2.5 py-1.5 text-xs font-bold text-plum"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="group flex items-start gap-2">
                  <Avatar seed={c.author} name={c.author} size={28} />
                  <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
                    <p className="text-xs font-bold">
                      {c.author}
                      {c.isMine && <span className="ml-1 text-[10px] font-semibold text-violet-ink">(you)</span>}
                    </p>
                    <p className="text-[13px] leading-snug">{c.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setCommentPicker(commentPicker === c.id ? null : c.id)}
                        aria-expanded={commentPicker === c.id}
                        className="flex items-center gap-0.5 text-[10px] font-semibold text-campus-text-sec transition hover:text-violet-ink dark:text-campus-dark-sec dark:hover:text-violet"
                      >
                        <Smile size={11} /> React
                      </button>
                      {activeReactions(c.reactions).map(({ def, count }) => (
                        <button
                          key={def.key}
                          onClick={() => app.reactToComment(post.id, c.id, def.key)}
                          aria-pressed={c.myReaction === def.key}
                          aria-label={`${def.label} — ${count}. Tap to toggle`}
                          className={`flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold transition active:scale-90 ${
                            c.myReaction === def.key
                              ? 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet'
                              : 'bg-campus-bg text-campus-text-sec hover:text-violet-ink dark:bg-campus-dark-card dark:text-campus-dark-sec'
                          }`}
                        >
                          <span aria-hidden="true">{def.emoji}</span> {count}
                        </button>
                      ))}
                      <span className="ml-auto text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    {commentPicker === c.id && (
                      <div className="mt-1 flex flex-wrap gap-0.5 rounded-xl bg-campus-bg p-1 dark:bg-campus-dark-card">
                        {REACTION_CATALOG.map((r) => (
                          <button
                            key={r.key}
                            onClick={() => {
                              app.reactToComment(post.id, c.id, r.key);
                              setCommentPicker(null);
                            }}
                            aria-label={`React ${r.label}`}
                            className="touch-target rounded-full px-1 text-base transition hover:scale-125"
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {c.isMine && (
                    <div className="flex flex-col gap-0.5 opacity-60 transition group-hover:opacity-100">
                      <button
                        aria-label="Edit comment"
                        onClick={() => {
                          setEditing(c.id);
                          setEditText(c.text);
                        }}
                        className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label="Delete comment"
                        onClick={() => app.deleteComment(post.id, c.id)}
                        className="rounded-lg p-1.5 text-coral hover:bg-coral-soft dark:hover:bg-coral/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!commentText.trim()) return;
              app.addComment(post.id, commentText.trim());
              setCommentText('');
            }}
            className="flex items-center gap-2 pt-1"
          >
            <Avatar seed={app.user.id} name={app.user.name} size={28} />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              className="min-w-0 flex-1 rounded-full border border-campus-border bg-white px-3.5 py-2 text-[13px] outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev dark:text-campus-dark-text"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              aria-label="Send comment"
              className="touch-target flex items-center justify-center rounded-full bg-violet text-plum disabled:opacity-40"
            >
              <CornerDownRight size={16} />
            </button>
          </form>
        </div>
      )}

      <Lightbox photos={post.media} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </article>
  );
}
