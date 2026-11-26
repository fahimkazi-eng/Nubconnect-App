'use client';

// ============================================================================
// CAMPUS ORBIT — Campus Honours (§9).
// Recognition for real contributions across transparent categories — never
// popularity. The Top Campus Contributor is computed from published criteria
// only (points + breadth), every student can opt out entirely, and there is
// no follower/like ranking anywhere on this page.
//
// Real backend data arrives through get_honours_feed(); the database policy
// already hides students who opted out. Demo mode keeps the clearly-labelled
// synthetic records.
// ============================================================================
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Info, Medal, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar, DemoTag } from '@/components/ui/kit';
import {
  HONOUR_CATEGORIES,
  HONOUR_CATEGORY_BLURBS,
  honourPointsByPerson,
  topCampusContributor,
} from '@/lib/orbit';
import type { HonourCategory } from '@/lib/types';

const SEASONS = ['Spring', 'Summer', 'Fall'];

function semesterRank(semester: string): number {
  const [season, year] = semester.split(/\s+/);
  const seasonIndex = SEASONS.indexOf(season ?? '');
  const yearNumber = Number(year);
  return (Number.isFinite(yearNumber) ? yearNumber : 0) * 10 + Math.max(seasonIndex, 0);
}

export default function HonoursPage() {
  const {
    user,
    privacy,
    setPrivacy,
    honours,
    honoursLoading,
    honoursError,
    refreshHonours,
  } = useApp();

  const isDemoHonours = honours.some((entry) => entry.isDemo);
  const optedOut = !privacy.showInHonours;

  const semesters = useMemo(() => {
    const unique = [...new Set(honours.map((entry) => entry.semester).filter(Boolean))];
    return unique.sort((a, b) => semesterRank(b) - semesterRank(a));
  }, [honours]);

  const [selectedSemester, setSelectedSemester] = useState<string>('');

  useEffect(() => {
    if (semesters.length === 0) return;
    if (!selectedSemester || !semesters.includes(selectedSemester)) {
      setSelectedSemester(semesters[0]!);
    }
  }, [semesters, selectedSemester]);

  const activeSemester = selectedSemester || semesters[0] || 'Fall 2026';

  const semesterEntries = useMemo(
    () => honours.filter((entry) => entry.semester === activeSemester),
    [honours, activeSemester],
  );

  const visibleEntries = semesterEntries.filter(
    (entry) => entry.personId !== user.id || !optedOut,
  );

  const top = topCampusContributor(semesterEntries, {
    semester: activeSemester,
    optedOut: optedOut ? [user.id] : [],
  });
  const myTally = honourPointsByPerson(honours, { semester: activeSemester }).get(user.id);
  const myEntries = semesterEntries.filter((entry) => entry.personId === user.id);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Campus Honours</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Recognition for real contributions — mentoring, organizing, showing up.
        </p>
      </header>

      {honoursLoading && (
        <div className="card animate-pulse p-4" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
          <div className="mt-3 h-3 w-2/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
        </div>
      )}

      {!honoursLoading && honoursError && (
        <div className="card p-4">
          <p className="text-sm font-bold">Campus Honours unavailable</p>
          <p className="mt-1 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            {honoursError}
          </p>
          <button
            onClick={() => void refreshHonours()}
            className="touch-target mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum"
          >
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      )}

      {!honoursLoading && !honoursError && (
        <>
          {/* Semester selection */}
          {semesters.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <label htmlFor="honours-semester" className="text-[11px] font-bold">
                Semester
              </label>
              <select
                id="honours-semester"
                value={activeSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="rounded-xl border border-campus-border bg-white px-3 py-1.5 text-xs font-semibold dark:border-campus-dark-border dark:bg-campus-dark-card"
              >
                {semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
              {isDemoHonours && <DemoTag compact />}
            </div>
          )}

          {/* Top Campus Contributor */}
          <section className="card p-4" aria-labelledby="top-contributor-h">
            <h2
              id="top-contributor-h"
              className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold"
            >
              <Trophy size={15} className="text-lime-ink dark:text-lime" /> Top Campus Contributor ·{' '}
              {activeSemester}
            </h2>
            {top ? (
              <div className="flex items-center gap-3 rounded-2xl bg-lime-soft p-3.5 dark:bg-lime/15">
                <Avatar seed={top.personId} name={top.personName} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-extrabold">{top.personName}</p>
                  <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    {top.departmentCode} • {top.points} contribution points
                  </p>
                </div>
                {isDemoHonours && <DemoTag compact />}
              </div>
            ) : (
              <p className="rounded-2xl bg-campus-bg p-3.5 text-sm text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                No contributor qualifies yet this semester — it takes points across at least three
                categories.
              </p>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              <Info size={12} className="mt-0.5 shrink-0 text-violet-ink" />
              How it&apos;s decided — openly: the most verified contribution points this semester,
              with breadth across at least three categories. Opted-out students never appear. There
              is no popularity vote, no follower count, and no hidden score.
            </p>
          </section>

          {/* My standing + opt-out */}
          <section className="card p-4" aria-labelledby="my-standing-h">
            <h2
              id="my-standing-h"
              className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold"
            >
              <Medal size={15} className="text-violet-ink" /> Your standing
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {optedOut
                  ? 'You are opted out of Campus Honours.'
                  : myTally
                    ? `${myTally.points} contribution points`
                    : 'No verified recognition yet this semester'}
                <span className="block text-[11px] font-normal text-campus-text-sec dark:text-campus-dark-sec">
                  {optedOut
                    ? 'Your name is hidden from this page and the Top Campus Contributor.'
                    : myTally
                      ? `${myTally.categories.size} categories · ${myEntries.length} verified entries`
                      : 'Recognition is awarded by clubs and the university — students never self-report.'}{' '}
                  {isDemoHonours && <DemoTag compact />}
                  {isDemoHonours && ' — synthetic recognition records.'}
                </span>
              </p>
              <button
                onClick={() => setPrivacy({ showInHonours: !privacy.showInHonours })}
                aria-pressed={!optedOut}
                className={`touch-target shrink-0 rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
                  optedOut
                    ? 'bg-violet text-plum'
                    : 'bg-campus-bg text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {optedOut ? 'Show me in honours' : 'Hide me from honours'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Opting out hides your name from this page and from the Top Campus Contributor —
              instantly, in both themes of campus life. Your contributions still count privately.
              Adjust anytime here or in{' '}
              <Link href="/settings" className="font-bold text-violet-ink hover:underline">
                Settings
              </Link>
              .
            </p>
          </section>

          {/* Honest empty state */}
          {visibleEntries.length === 0 && (
            <div className="card p-8 text-center">
              <Trophy
                size={22}
                className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
              />
              <p className="mt-2 font-display font-bold">
                No recognition published for {activeSemester} yet
              </p>
              <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {isDemoHonours
                  ? 'This demo semester has no entries.'
                  : 'Club representatives and university admins award Campus Honours to approved members. Nothing is invented to fill this page.'}
              </p>
            </div>
          )}

          {/* Categories */}
          {HONOUR_CATEGORIES.map((cat: HonourCategory) => {
            const entries = visibleEntries.filter((entry) => entry.category === cat);
            if (entries.length === 0) return null;
            return (
              <section key={cat} aria-labelledby={`hon-${cat.replace(/\s+/g, '-').toLowerCase()}`}>
                <h2
                  id={`hon-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                  className="mb-1 px-1 font-display text-sm font-bold"
                >
                  <Sparkles size={13} className="mr-1 inline align-[-2px] text-violet-ink" /> {cat}
                </h2>
                <p className="mb-2 px-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                  {HONOUR_CATEGORY_BLURBS[cat]}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="card p-3.5">
                      <div className="flex items-start gap-3">
                        <Avatar seed={entry.personId} name={entry.personName} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[13px] font-bold">{entry.personName}</p>
                          <p className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                            {entry.departmentCode} • {entry.semester}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-violet-soft px-2 py-0.5 font-mono text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                          +{entry.points}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold leading-snug">{entry.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                        {entry.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
