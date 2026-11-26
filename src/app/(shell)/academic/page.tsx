'use client';

// Academic — deliberately the most utilitarian surface. Verified NUB 4.00
// grade scale and Bi/Tri-Semester split are preserved; the GPA/CGPA
// calculator uses the same pure functions as the unit tests. Every result
// is labelled an Unofficial Student Estimate (§12.3).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, CalendarDays, GraduationCap, Users2, BookOpen, FileText, Info } from 'lucide-react';
import { DEMO_DEPARTMENTS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { DemoTag, Tabs } from '@/components/ui/kit';
import { calculateGpa, calculateCgpa, gpaStanding, NUB_GRADE_MAP, semesterSystemForDepartment } from '@/lib/academic';

interface Row {
  code: string;
  credits: string;
  grade: string;
}

export default function AcademicPage() {
  const { user, joinedGroups } = useApp();
  // Sample rows/semesters are a development fixture; a connected campus
  // starts the estimator empty so no invented grades are ever displayed.
  const configured = isBackendConfigured();
  const [tab, setTab] = useState('calculator');

  // ---- GPA calculator state ----
  const [rows, setRows] = useState<Row[]>(() =>
    configured
      ? []
      : [
          { code: 'CSE-301', credits: '3', grade: 'A' },
          { code: 'CSE-303', credits: '3', grade: 'A+' },
          { code: 'CSE-305', credits: '1.5', grade: 'B+' },
        ],
  );

  // ---- CGPA state ----
  const [semesters, setSemesters] = useState(() =>
    configured
      ? []
      : [
          { gpa: '3.65', credits: '16.5' },
          { gpa: '3.72', credits: '17' },
          { gpa: '3.80', credits: '16' },
        ],
  );

  // Demo department metadata is only available in an unconfigured build.
  const myDept = configured ? undefined : DEMO_DEPARTMENTS.find((d) => d.code === user.departmentCode);
  const mySystem = semesterSystemForDepartment(user.departmentCode);

  const gpaResult = useMemo(() => {
    const courses = rows
      .filter((r) => r.code.trim() && r.credits && r.grade)
      .map((r) => ({ code: r.code.trim(), title: '', credits: Number(r.credits), grade: r.grade }));
    return calculateGpa(courses);
  }, [rows]);

  const cgpaResult = useMemo(() => {
    const sems = semesters
      .filter((s) => s.gpa && s.credits)
      .map((s) => ({ gpa: Number(s.gpa), credits: Number(s.credits) }));
    return calculateCgpa(sems);
  }, [semesters]);

  const setRow = (i: number, key: keyof Row, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const cellCls =
    'w-full rounded-lg border border-campus-border bg-white px-2 py-1.5 text-xs outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev dark:text-campus-dark-text';

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Academic</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          The verified NUB 4.00 scale, your department&apos;s calendar, and a CGPA estimator — clearly unofficial estimates.
        </p>
      </header>

      {/* My department quick card */}
      {myDept && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <GraduationCap size={17} className="text-violet-ink" />
          <span className="text-sm font-bold">
            {myDept.code} — {myDept.semesterSystem}
          </span>
          <Link href={`/department/${myDept.code.toLowerCase()}`} className="ml-auto text-xs font-bold text-violet-ink hover:underline">
            Department hub →
          </Link>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'calculator', label: 'GPA / CGPA' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'study', label: 'Study Groups' },
          { key: 'resources', label: 'Resources' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* GPA CALCULATOR */}
      {tab === 'calculator' && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold">
              <Calculator size={16} className="text-violet-ink" /> Semester GPA — {mySystem}
            </h2>
            <span className="font-mono text-[10px] font-bold text-campus-text-sec dark:text-campus-dark-sec">NUB 4.00 scale</span>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_70px_80px_32px] gap-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
              <span>Course</span>
              <span>Credits</span>
              <span>Grade</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_80px_32px] gap-1.5">
                <input value={r.code} onChange={(e) => setRow(i, 'code', e.target.value)} aria-label={`Course ${i + 1} code`} className={cellCls} placeholder="CSE-301" />
                <input
                  value={r.credits}
                  onChange={(e) => setRow(i, 'credits', e.target.value.replace(/[^0-9.]/g, ''))}
                  aria-label={`Course ${i + 1} credits`}
                  className={cellCls}
                  inputMode="decimal"
                />
                <select value={r.grade} onChange={(e) => setRow(i, 'grade', e.target.value)} aria-label={`Course ${i + 1} grade`} className={cellCls}>
                  {Object.keys(NUB_GRADE_MAP).map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <button
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label={`Remove course ${i + 1}`}
                  className="flex items-center justify-center rounded-lg text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
                >
                  ×
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="rounded-xl bg-campus-bg p-3 text-xs font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                Add your courses below to estimate your semester GPA.
              </p>
            )}
            <button
              onClick={() => setRows((rs) => [...rs, { code: '', credits: '3', grade: 'A' }])}
              className="touch-target w-full rounded-xl bg-campus-bg py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
            >
              + Add course
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-violet-soft p-3.5 dark:bg-violet-dark-soft">
            <span className="text-xs font-bold text-campus-text-sec dark:text-campus-dark-sec">Semester GPA</span>
            <span className="text-right">
              <span className="font-mono text-2xl font-extrabold text-violet-ink">{gpaResult.toFixed(2)}</span>
              <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold text-campus-text-sec dark:bg-campus-dark-card/60 dark:text-campus-dark-sec">
                {gpaStanding(gpaResult)}
              </span>
            </span>
          </div>

          {/* CGPA */}
          <div className="mt-6">
            <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
              <Calculator size={16} className="text-violet-ink" /> Cumulative CGPA
            </h3>
            <div className="space-y-2">
              {semesters.map((s, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_90px_32px] items-center gap-1.5">
                  <span className="text-[11px] font-bold text-campus-text-sec dark:text-campus-dark-sec">Semester {i + 1}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={s.gpa}
                      onChange={(e) => setSemesters((ss) => ss.map((x, j) => (j === i ? { ...x, gpa: e.target.value.replace(/[^0-9.]/g, '') } : x)))}
                      aria-label={`Semester ${i + 1} GPA`}
                      className={cellCls}
                      inputMode="decimal"
                      placeholder="GPA"
                    />
                    <input
                      value={s.credits}
                      onChange={(e) => setSemesters((ss) => ss.map((x, j) => (j === i ? { ...x, credits: e.target.value.replace(/[^0-9.]/g, '') } : x)))}
                      aria-label={`Semester ${i + 1} credits`}
                      className={cellCls}
                      inputMode="decimal"
                      placeholder="Credits"
                    />
                  </div>
                  <span className="font-mono text-[10px] text-campus-text-sec dark:text-campus-dark-sec">of 4.00</span>
                  <button
                    onClick={() => setSemesters((ss) => ss.filter((_, j) => j !== i))}
                    aria-label={`Remove semester ${i + 1}`}
                    className="flex items-center justify-center rounded-lg text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
                  >
                    ×
                  </button>
                </div>
              ))}
              {semesters.length === 0 && (
                <p className="rounded-xl bg-campus-bg p-3 text-xs font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                  Add a semester below to estimate your CGPA.
                </p>
              )}
              <button
                onClick={() => setSemesters((ss) => [...ss, { gpa: '3.5', credits: '16' }])}
                className="touch-target w-full rounded-xl bg-campus-bg py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
              >
                + Add semester
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-lime-soft p-3.5 dark:bg-lime/10">
              <span className="text-xs font-bold text-campus-text-sec dark:text-campus-dark-sec">Estimated CGPA</span>
              <span className="text-right">
                <span className="font-mono text-2xl font-extrabold text-lime-ink dark:text-lime">{cgpaResult.toFixed(2)}</span>
                <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold text-campus-text-sec dark:bg-campus-dark-card/60 dark:text-campus-dark-sec">
                  {gpaStanding(cgpaResult)}
                </span>
              </span>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            <Info size={12} className="mt-0.5 shrink-0" />
            Unofficial Student Estimate. Official results come only from Northern University Bangladesh. Grade scale
            verified against nub.ac.bd academic system pages.
          </p>
        </div>
      )}

      {/* CALENDAR */}
      {tab === 'calendar' && (configured ? (
          <div className="card p-6 text-center">
            <CalendarDays size={22} className="mx-auto text-violet-ink" />
            <p className="mt-2 font-display text-sm font-bold">Official calendar not connected yet</p>
            <p className="mt-1 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Academic dates come from Northern University Bangladesh and are published on{' '}
              <a href="https://www.nub.ac.bd/" target="_blank" rel="noopener noreferrer" className="font-bold text-violet-ink hover:underline">
                nub.ac.bd
              </a>
              . NUBCONNECT will show the official calendar once it is synced — no invented dates.
            </p>
          </div>
        ) : (
        <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
          <div className="flex items-center gap-2 p-3.5">
            <CalendarDays size={16} className="shrink-0 text-violet-ink" />
            <p className="text-sm font-bold">Tri-Semester departments</p>
            <span className="ml-auto font-mono text-[10px] font-bold text-campus-text-sec dark:text-campus-dark-sec">
              {DEMO_DEPARTMENTS.filter((d) => d.semesterSystem.includes('Tri')).length} depts
            </span>
          </div>
          <div className="flex items-center gap-2 p-3.5">
            <CalendarDays size={16} className="shrink-0 text-aqua" />
            <p className="text-sm font-bold">Bi-Semester departments</p>
            <span className="ml-auto font-mono text-[10px] font-bold text-campus-text-sec dark:text-campus-dark-sec">
              {DEMO_DEPARTMENTS.filter((d) => d.semesterSystem.includes('Bi')).length} depts
            </span>
          </div>
          <div className="p-3.5">
            <p className="mb-2 text-sm font-bold">Upcoming academic dates</p>
            <div className="space-y-1.5">
              {[
                { d: 'Nov 20', t: 'Bi-Semester final submission window opens' },
                { d: 'Dec 05', t: 'Tri-Semester Fall registration deadline' },
                { d: 'Dec 18', t: 'Winter break begins' },
              ].map((e) => (
                <div key={e.d} className="flex items-center gap-3 rounded-xl bg-campus-bg p-2.5 dark:bg-campus-dark-elev">
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-soft font-mono text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                    {e.d}
                  </span>
                  <span className="text-xs font-semibold">{e.t}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
              <DemoTag compact /> demo dates — the official calendar syncs from nub.ac.bd when the backend is connected.
            </p>
          </div>
        </div>
        )
      )}

      {/* STUDY GROUPS */}
      {tab === 'study' && (
        configured ? (
          <div className="card p-6 text-center">
            <Users2 size={22} className="mx-auto text-violet-ink" />
            <p className="mt-2 font-display text-sm font-bold">Study groups live in Circle</p>
            <p className="mt-1 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Your study and course groups are listed with their real members in the{' '}
              <Link href="/circle?tab=circles" className="font-bold text-violet-ink hover:underline">
                Groups
              </Link>{' '}
              directory.
            </p>
          </div>
        ) : (
        <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
          {[
            { n: 'DBMS Evening Batch', m: 8, j: joinedGroups.includes('grp-dbms') },
            { n: 'Hinari Research Reading Circle', m: 6, j: joinedGroups.includes('grp-hinari') },
            { n: 'CSE 2022 Cohort Group', m: 24, j: joinedGroups.includes('grp-cse-2022') },
          ].map((g) => (
            <Link key={g.n} href="/circle?tab=circles" className="flex items-center gap-3 p-3.5 transition hover:bg-violet-soft/50 dark:hover:bg-violet-dark-soft/50">
              <Users2 size={16} className="shrink-0 text-violet-ink" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{g.n}</p>
                <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{g.m} members</p>
              </div>
              {g.j ? (
                <span className="shrink-0 rounded-full bg-lime-soft px-2 py-0.5 text-[10px] font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">Joined</span>
              ) : (
                <span className="shrink-0 text-xs font-bold text-violet-ink">Join →</span>
              )}
            </Link>
          ))}
        </div>
        )
      )}

      {/* RESOURCES */}
      {tab === 'resources' && (
        <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
          <a href="https://www.nub.ac.bd/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3.5 transition hover:bg-violet-soft/50 dark:hover:bg-violet-dark-soft/50">
            <BookOpen size={16} className="shrink-0 text-aqua" />
            <span className="flex-1 text-sm font-semibold">Official NUB website (nub.ac.bd)</span>
            <span className="text-[10px] font-bold text-campus-text-sec dark:text-campus-dark-sec">OFFICIAL</span>
          </a>
          {configured ? (
            <p className="p-3.5 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              More resources (past papers, department notice boards) will appear here once NUB connects its official
              resource feed to NUBCONNECT.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3.5">
                <FileText size={16} className="shrink-0 text-violet-ink" />
                <span className="flex-1 text-sm font-semibold">
                  Past-paper archive <DemoTag compact />
                </span>
              </div>
              <div className="flex items-center gap-3 p-3.5">
                <FileText size={16} className="shrink-0 text-violet-ink" />
                <span className="flex-1 text-sm font-semibold">
                  Department notice board <DemoTag compact />
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
