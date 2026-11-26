// ============================================================================
// NUBCONNECT — reactions.ts unit tests (§8)
// Universal reaction catalog integrity + contextual action mapping. The
// vocabulary is ORIGINAL to NUBCONNECT (Love/Fire/LOL/Respect/Amazing/
// Support/Inspired/Proud) and contextual actions must stay per-kind — one
// meaningful action per content kind, never every action everywhere.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  REACTION_CATALOG,
  QUICK_REACTION,
  CONTEXT_ACTIONS,
  reactionDef,
  activeReactions,
  totalReactionCount,
  contextKindForPost,
  contextActionForPost,
} from '@/lib/reactions';
import type { Post, ReactionType } from '@/lib/types';
import type { PostContextKind } from '@/lib/reactions';

const ALL_REACTION_KEYS: ReactionType[] = [
  'love',
  'fire',
  'lol',
  'respect',
  'amazing',
  'support',
  'inspired',
  'proud',
];

function kindPost(
  partial: Partial<Pick<Post, 'category' | 'originBadge' | 'circleSlug'>>,
): Pick<Post, 'category' | 'originBadge' | 'circleSlug'> {
  return {
    category: 'Student Discussion',
    originBadge: 'Student Community Post',
    circleSlug: undefined,
    ...partial,
  };
}

describe('REACTION_CATALOG', () => {
  it('has exactly the eight universal reactions', () => {
    expect(REACTION_CATALOG.map((r) => r.key)).toEqual(ALL_REACTION_KEYS);
  });

  it('has unique keys and emojis', () => {
    expect(new Set(REACTION_CATALOG.map((r) => r.key)).size).toBe(REACTION_CATALOG.length);
    expect(new Set(REACTION_CATALOG.map((r) => r.emoji)).size).toBe(REACTION_CATALOG.length);
  });

  it('labels every entry (labels are unique)', () => {
    const labels = REACTION_CATALOG.map((r) => r.label);
    expect(labels.every(Boolean)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('quick reaction is part of the catalog', () => {
    expect(REACTION_CATALOG.some((r) => r.key === QUICK_REACTION)).toBe(true);
  });

  it('reactionDef falls back defensively on unknown keys', () => {
    // Cast deliberately: read paths must survive legacy/unknown values.
    expect(reactionDef('like' as ReactionType).key).toBe(REACTION_CATALOG[0].key);
  });
});

describe('activeReactions / totalReactionCount', () => {
  it('shows only reactions with a positive count, in catalog order', () => {
    const out = activeReactions({ inspired: 4, fire: 0, love: 9 });
    expect(out.map((r) => r.def.key)).toEqual(['love', 'inspired']);
    expect(out.map((r) => r.count)).toEqual([9, 4]);
  });

  it('treats missing counts as zero', () => {
    expect(activeReactions(undefined)).toEqual([]);
    expect(activeReactions({})).toEqual([]);
    expect(totalReactionCount(undefined)).toBe(0);
  });

  it('sums every type for the total count', () => {
    expect(totalReactionCount({ love: 12, fire: 3, inspired: 1 })).toBe(16);
  });
});

describe('contextKindForPost', () => {
  it('maps known categories to their content kind', () => {
    expect(contextKindForPost(kindPost({ category: 'Event' }))).toBe('event');
    expect(contextKindForPost(kindPost({ category: 'Achievement' }))).toBe('achievement');
    expect(contextKindForPost(kindPost({ category: 'Project' }))).toBe('project');
    expect(contextKindForPost(kindPost({ category: 'Question' }))).toBe('question');
    expect(contextKindForPost(kindPost({ category: 'Campus Photo' }))).toBe('photography');
    expect(contextKindForPost(kindPost({ category: 'Club Activity' }))).toBe('club-announcement');
    expect(contextKindForPost(kindPost({ category: 'Study Group' }))).toBe('activity');
  });

  it('falls back to origin badge and circle cues', () => {
    expect(contextKindForPost(kindPost({ originBadge: 'Club Activity' }))).toBe('club-announcement');
    expect(contextKindForPost(kindPost({ circleSlug: 'photography' }))).toBe('photography');
  });

  it('defaults to general for ordinary discussion', () => {
    expect(contextKindForPost(kindPost({}))).toBe('general');
  });
});

describe('contextActionForPost — one meaningful action per kind', () => {
  const KINDS_WITH_ACTION: PostContextKind[] = [
    'event',
    'achievement',
    'project',
    'question',
    'photography',
    'club-announcement',
    'activity',
    'marketplace',
  ];

  it('every content kind except general offers exactly one action', () => {
    for (const kind of KINDS_WITH_ACTION) {
      const action = CONTEXT_ACTIONS[kind];
      expect(action, `kind ${kind} must have an action`).not.toBeNull();
      expect(action!.label).toBeTruthy();
      expect(action!.activeLabel).toBeTruthy();
      expect(action!.emoji).toBeTruthy();
    }
  });

  it('general posts deliberately offer NO contextual action', () => {
    expect(CONTEXT_ACTIONS.general).toBeNull();
    expect(contextActionForPost(kindPost({}))).toBeNull();
  });

  it('action keys are present and well-formed (event & marketplace may share “interested”)', () => {
    const keys = KINDS_WITH_ACTION.map((k) => CONTEXT_ACTIONS[k]!.key);
    expect(keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true);
    // Event + Marketplace both express "Interested" by design.
    expect(CONTEXT_ACTIONS.event!.key).toBe('interested');
    expect(CONTEXT_ACTIONS.marketplace!.key).toBe('interested');
  });

  it('returns the action matching the post kind', () => {
    expect(contextActionForPost(kindPost({ category: 'Achievement' }))?.key).toBe('celebrate');
    expect(contextActionForPost(kindPost({ category: 'Question' }))?.key).toBe('can-help');
    expect(contextActionForPost(kindPost({ category: 'Campus Photo' }))?.key).toBe('appreciate');
  });
});
