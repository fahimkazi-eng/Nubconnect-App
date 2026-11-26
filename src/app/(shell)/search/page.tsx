'use client';

// Search — one box across the connected campus. Every result comes from a
// real Supabase surface through the privacy-aware data layer in src/lib/search.
// Recent searches are the student's own history, not sample results.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Hash,
  History,
  Home,
  LoaderCircle,
  Package,
  Search as SearchIcon,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import {
  SEARCH_SURFACES,
  SEARCH_SURFACE_LABELS,
  searchCampus,
  type SearchHit,
  type SearchResult,
  type SearchSurface,
} from '@/lib/search';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { Avatar, EmptyState } from '@/components/ui/kit';

const EMPTY_RESULT: SearchResult = {
  hits: [],
  groups: [],
  unavailable: [],
  configured: true,
};

const KIND_ICON: Record<SearchHit['kind'], React.ReactNode> = {
  Person: <UserRound size={12} />,
  Post: <Hash size={12} />,
  Club: <Store size={12} />,
  Circle: <UserRound size={12} />,
  Group: <BookOpen size={12} />,
  Department: <GraduationCap size={12} />,
  Event: <CalendarDays size={12} />,
  Pulse: <Activity size={12} />,
  Product: <Package size={12} />,
  Room: <Home size={12} />,
};

function groupLabel(kind: SearchHit['kind']): string {
  if (kind === 'Product') return 'Marketplace';
  if (kind === 'Pulse') return 'Campus Pulse';
  return `${kind}s`;
}

function SearchSurface() {
  const params = useSearchParams();
  const paramQuery = params.get('q') ?? '';
  const { user, recentSearches, pushRecentSearch, clearRecentSearches } = useApp();
  const [query, setQuery] = useState(paramQuery);
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const viewerId = user?.id ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Ctrl+K from another page can arrive with a fresh ?q= while mounted.
  useEffect(() => {
    if (paramQuery) setQuery(paramQuery);
  }, [paramQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult(EMPTY_RESULT);
      setLoading(false);
      setError(null);
      return;
    }
    if (!client) {
      setResult({ ...EMPTY_RESULT, configured: false });
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void searchCampus(client, trimmed, { viewerId })
        .then((next) => {
          if (cancelled) return;
          setResult(next);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResult(EMPTY_RESULT);
          setError('Search could not be completed. Please try again.');
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, client, viewerId, attempt]);

  const submit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed) pushRecentSearch(trimmed);
  }, [query, pushRecentSearch]);

  const unavailableCopy = result.unavailable
    .map((surface: SearchSurface) => SEARCH_SURFACE_LABELS[surface])
    .join(', ');

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Search campus</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          People, posts, clubs, circles, groups, departments, events, Pulse, marketplace and rooms —
          from connected campus data only.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <SearchIcon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search NUBCONNECT…"
          aria-label="Search NUBCONNECT"
          className="touch-target w-full rounded-2xl border border-campus-border bg-campus-card py-3 pl-10 pr-10 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="hit-pad absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
          >
            <X size={15} />
          </button>
        )}
      </form>

      {/* Recent searches — this student's own history, never sample results. */}
      {!query.trim() && recentSearches.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
              <History size={13} /> Recent
            </h2>
            <button
              onClick={clearRecentSearches}
              className="text-[11px] font-bold text-campus-text-sec hover:text-coral dark:text-campus-dark-sec"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((r) => (
              <button
                key={r}
                onClick={() => setQuery(r)}
                className="rounded-full bg-campus-bg px-3 py-1.5 text-xs font-semibold text-campus-text-sec ring-1 ring-campus-border transition hover:text-violet-ink dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border"
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      {query.trim() && !client ? (
        <EmptyState
          icon={<SearchIcon size={22} />}
          title="Search is not connected"
          body="Campus search needs a connected Supabase backend. No sample or offline results are shown. Ask an administrator to configure the campus connection."
        />
      ) : query.trim() && loading ? (
        <div className="card flex items-center gap-3 p-4 text-sm font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          <LoaderCircle size={18} className="animate-spin" /> Searching connected campus data…
        </div>
      ) : query.trim() && error ? (
        <div className="card p-4">
          <p className="text-sm font-bold">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 rounded-full bg-violet-soft px-3 py-1.5 text-xs font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet"
          >
            Try again
          </button>
        </div>
      ) : query.trim() && result.unavailable.length === SEARCH_SURFACES.length ? (
        <EmptyState
          icon={<SearchIcon size={22} />}
          title="Search is unavailable right now"
          body="None of the campus data surfaces could be reached. No results are shown rather than guessing what you meant."
        />
      ) : query.trim() ? (
        <div className="space-y-4">
          {result.unavailable.length > 0 && (
            <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-semibold text-coral-ink dark:bg-coral/10 dark:text-coral">
              Could not search {unavailableCopy} just now. Results below are from the remaining
              surfaces only.
            </p>
          )}

          {result.hits.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={22} />}
              title={`No matches for “${query.trim()}”`}
              body="Check the spelling or try a broader word. Only real campus data from connected surfaces is searched."
            />
          ) : (
            <>
              <p className="px-1 text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                {result.hits.length} result{result.hits.length === 1 ? '' : 's'} · top matches from
                connected campus data
              </p>
              {result.groups.map((g) => (
                <section key={g.kind}>
                  <h2 className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[13px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                    {KIND_ICON[g.kind]} {groupLabel(g.kind)} ({g.items.length})
                  </h2>
                  <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
                    {g.items.map((h) => (
                      <Link
                        key={h.id}
                        href={h.href}
                        className="flex items-center gap-3 p-3 transition hover:bg-violet-soft/40 dark:hover:bg-violet-dark-soft/40"
                      >
                        {h.thumb ? (
                          <img src={h.thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-campus-bg dark:bg-campus-dark-elev">
                            <Avatar seed={h.seed ?? h.id} name={h.title} size={38} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {h.title}{' '}
                            {h.verified && (
                              <BadgeCheck
                                size={13}
                                className="inline align-[-2px] text-violet"
                                aria-label="Verified student"
                              />
                            )}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                            {h.subtitle}
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec"
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-bold">Try searching for</h2>
          <div className="flex flex-wrap gap-1.5">
            {['CSE', 'photography', 'Nikunja', 'study', 'coffee', 'calculator'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  pushRecentSearch(s);
                }}
                className="rounded-full bg-violet-soft px-3 py-1.5 text-xs font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <SearchSurface />
    </Suspense>
  );
}
