'use client';

// Opportunities — leadership roles, on-campus jobs, competitions and
// volunteering gathered for NUB students.
import { useMemo, useState } from 'react';
import { Briefcase, Sparkles } from 'lucide-react';
import { DEMO_OPPORTUNITIES } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';
import { Chip, DemoTag, EmptyState } from '@/components/ui/kit';

export default function OpportunitiesPage() {
  const [category, setCategory] = useState('All');

  // Sample opportunities are a development fixture; a connected campus shows
  // only opportunities the university has actually published.
  const opportunities = isBackendConfigured() ? [] : DEMO_OPPORTUNITIES;

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(opportunities.map((o) => o.category)))],
    [opportunities],
  );
  const visible = category === 'All' ? opportunities : opportunities.filter((o) => o.category === category);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Opportunities</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Roles, competitions and volunteering worth your semester.
        </p>
      </header>

      {categories.length > 2 && (
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c === 'All' ? <Sparkles size={11} /> : null}
              {c}
            </Chip>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} />} title="Nothing here yet" body="Check back as clubs and departments post new opportunities." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((o) => (
            <article key={o.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-[15px] font-bold leading-tight">{o.title}</h2>
                {o.isDemo && <DemoTag compact />}
              </div>
              <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-violet-soft px-2.5 py-1 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                {o.category}
              </span>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{o.description}</p>
              <p className="mt-3 border-t border-campus-border pt-2 text-[11px] font-semibold text-campus-text-sec dark:border-campus-dark-border dark:text-campus-dark-sec">
                Apply through the organizing desk or message the club on NUBCONNECT.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
