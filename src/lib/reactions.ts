// ============================================================================
// NUBCONNECT — Reaction system v2 (§8).
//
// Two deliberate design rules from the product policy live here:
//   1. The universal vocabulary is ORIGINAL — Love/Fire/LOL/Respect/Amazing/
//      Support/Inspired/Proud — not a copy of any existing platform's set.
//   2. Contextual actions are per content kind: an event post offers
//      "Interested", an achievement offers "Celebrate", a question offers
//      "I can help"… but NEVER every action everywhere.
//
// Pure data + pure functions only (unit-tested in tests/reactions.test.ts).
// ============================================================================
import type { Post, ReactionType } from './types';

/* === Universal reaction catalog ============================================ */

export interface ReactionDef {
  key: ReactionType;
  emoji: string;
  label: string;
}

/** The eight universal reactions, in canonical display order. */
export const REACTION_CATALOG: readonly ReactionDef[] = [
  { key: 'love', emoji: '💜', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'lol', emoji: '😂', label: 'LOL' },
  { key: 'respect', emoji: '👏', label: 'Respect' },
  { key: 'amazing', emoji: '🚀', label: 'Amazing' },
  { key: 'support', emoji: '🤝', label: 'Support' },
  { key: 'inspired', emoji: '💡', label: 'Inspired' },
  { key: 'proud', emoji: '🎓', label: 'Proud' },
];

/** A tap (without holding) sends this reaction — the most common response. */
export const QUICK_REACTION: ReactionType = 'love';

/** Catalog lookup with a total for unknown keys (defensive on read paths). */
export function reactionDef(key: ReactionType): ReactionDef {
  return REACTION_CATALOG.find((r) => r.key === key) ?? REACTION_CATALOG[0];
}

/** Ordered reaction entries with count > 0 for compact chip rows. */
export function activeReactions(
  counts: Partial<Record<ReactionType, number>> | undefined,
): { def: ReactionDef; count: number }[] {
  if (!counts) return [];
  return REACTION_CATALOG.filter((def) => (counts[def.key] ?? 0) > 0).map((def) => ({
    def,
    count: counts[def.key] as number,
  }));
}

/** Total across types (never a "popularity score" — just a count). */
export function totalReactionCount(
  counts: Partial<Record<ReactionType, number>> | undefined,
): number {
  if (!counts) return 0;
  return REACTION_CATALOG.reduce((sum, def) => sum + (counts[def.key] ?? 0), 0);
}

/* === Contextual actions per content kind (§8) ============================== */

export type PostContextKind =
  | 'event'
  | 'achievement'
  | 'project'
  | 'question'
  | 'photography'
  | 'club-announcement'
  | 'activity'
  | 'marketplace'
  | 'general';

export interface ContextActionDef {
  key: string;
  label: string;
  /** Label once the student has responded */
  activeLabel: string;
  emoji: string;
}

const CATEGORY_KIND: Record<string, PostContextKind> = {
  'Campus Photo': 'photography',
  'Club Activity': 'club-announcement',
  'Study Group': 'activity',
  Question: 'question',
  Achievement: 'achievement',
  Project: 'project',
  Event: 'event',
  Activity: 'activity',
};

/** Map a post to its content kind — category first, then origin/circle cues. */
export function contextKindForPost(
  post: Pick<Post, 'category' | 'originBadge' | 'circleSlug'>,
): PostContextKind {
  const byCategory = CATEGORY_KIND[post.category];
  if (byCategory) return byCategory;
  if (post.originBadge === 'Club Activity') return 'club-announcement';
  if (post.circleSlug === 'photography') return 'photography';
  return 'general';
}

/** The single contextual action offered for each kind (null = none). */
export const CONTEXT_ACTIONS: Record<PostContextKind, ContextActionDef | null> = {
  event: { key: 'interested', label: 'Interested', activeLabel: 'Interested', emoji: '⭐' },
  achievement: { key: 'celebrate', label: 'Celebrate', activeLabel: 'Celebrating', emoji: '🎉' },
  project: { key: 'collaborate', label: 'Collaborate', activeLabel: 'Collaborating', emoji: '🤝' },
  question: { key: 'can-help', label: 'I can help', activeLabel: 'Helping', emoji: '🙌' },
  photography: { key: 'appreciate', label: 'Appreciate', activeLabel: 'Appreciated', emoji: '📸' },
  'club-announcement': { key: 'follow', label: 'Follow updates', activeLabel: 'Following', emoji: '🔔' },
  activity: { key: 'join', label: 'Count me in', activeLabel: "You're in", emoji: '✅' },
  marketplace: { key: 'interested', label: 'Interested', activeLabel: 'Interested', emoji: '⭐' },
  general: null,
};

/** The contextual action for a post, or null when the kind has none. */
export function contextActionForPost(
  post: Pick<Post, 'category' | 'originBadge' | 'circleSlug'>,
): ContextActionDef | null {
  return CONTEXT_ACTIONS[contextKindForPost(post)];
}
