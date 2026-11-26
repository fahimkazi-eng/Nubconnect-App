# NUBCONNECT — Design Token System

This document is the reference for the central token system defined in
`tailwind.config.ts` (palette + motion + type) and `src/app/globals.css`
(ambient layers, glass, skeletons, a11y focus feedback).

## Identity, not decoration

NUB Connect is a university social product, not a generic dashboard. The palette
is Electric Violet on warm campus cream with aqua/lime/coral accents — chosen so
the feed reads as lively but calm. Contrast contract (WCAG 2.2 AA, verified
2026-11-10) is documented in `tailwind.config.ts`. Use it.

## Semantic roles

| Role | Token | Notes |
| --- | --- | --- |
| Page background | `bg-campus-bg` / `dark:bg-campus-dark-bg` | warm cream / midnight plum |
| Card surface | `bg-campus-card` / `dark:bg-campus-dark-card` | near-opaque, bordered |
| Elevated surface | `bg-campus-dark-elev` (dark only) | menus, sheets |
| Primary action | `bg-violet` + `text-plum` | the ink-on-vivid signature |
| Primary action (text) | `text-violet-ink` light / `text-violet` dark | AA-cleared |
| Secondary text | `text-campus-text-sec` / `dark:text-campus-dark-sec` | metadata, captions |
| Borders | `border-campus-border` / `dark:border-campus-dark-border` | subtle |
| Success / warning / error | `lime-ink` / `sunshine` / `coral-ink` | + their soft fills |
| Focus ring | `:focus-visible` (globals.css) | violet-ink light / #A79AFB dark |

## Rules

1. **Never** invent a new hue ad hoc. Add to the token file first, with a
   contrast comment, then use it.
2. Fills take **plum ink**. Text accents take the `ink` variant (light) or the
   raw accent (dark) — raw accents on light surfaces fail AA.
3. Glass (`glass`, `glass-strong`) is for **chrome only**: sidebar, sheets,
   dialogs, floating controls. Content surfaces (`card`) stay near-opaque.
4. One accent per view hierarchy level. Don't make every card colorful.
5. Motion: 150–320ms, transforms/opacity only. `.btn-press` (press feedback),
   `.hover-lift` (media cards), `.chip-toggle` (selected states),
   `.animate-*` utilities. Everything respects `prefers-reduced-motion`
   (globals.css) — do not add motion outside the media-query guards.
6. `.touch-target` (44px) on every interactive control; `.hit-pad` to extend
   tiny icons to ~44px without visual change.
7. Safe areas: `.safe-top` / `.safe-bottom` / `.pt-safe-header` for notched
   devices and installed PWA.

## Typography

`font-display` (Plus Jakarta Sans) for headings and prices/numbers;
`font-sans` (Inter) for body; `font-mono` (JetBrains Mono) for counters,
stamps and codes. Sizes run one step smaller than a generic dashboard —
information density with `font-semibold` over `font-bold` where possible.

## Accessibility contract

- Visible focus ring on every keyboard-reachable control (`:focus-visible`).
- Reduced motion: all animation durations collapse to ~0, final state stays
  visible; tilt cards and orbiting nodes are fully removed.
- `aria-pressed`/`aria-selected` on toggles and tabs (`Chip`, `Tabs` set these).
- Images are either decorative (`alt=""`) or carry meaningful alt text.
- Icon-only buttons always have an `aria-label`.
