'use client';

// Lost & Found — items lost or found around campus, split by kind. Claims
// are handled through NUBCONNECT messages, never through public phone
// numbers.
import { useMemo, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { DEMO_LOST_FOUND, DEMO_PEOPLE } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { DemoTag, EmptyState, Tabs } from '@/components/ui/kit';

export default function LostFoundPage() {
  const [tab, setTab] = useState('all');
  const configured = isBackendConfigured();
  const { startConversation } = useApp();

  const visible = useMemo(() => {
    // Sample items are a development fixture; a connected campus shows only
    // what students have actually reported.
    const items = configured ? [] : DEMO_LOST_FOUND;
    if (tab === 'lost') return items.filter((i) => i.kind === 'Lost');
    if (tab === 'found') return items.filter((i) => i.kind === 'Found');
    return items;
  }, [tab, configured]);
  const items = visible;

  // Route claims to a fixed demo desk conversation rather than a fabricated person.
  const claim = (title: string) => {
    const desk = DEMO_PEOPLE.find((p) => p.id === 'p-sumaiya');
    startConversation({
      personId: desk?.id ?? 'p-sumaiya',
      title: 'Lost & Found — claim enquiry',
      kind: 'direct',
      initialNote: `Hi! I believe the “${title}” item belongs to me. I can describe it in detail to claim it.`,
    });
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Lost &amp; Found</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Lost something on campus? Found something that isn&apos;t yours? Post it here — claims happen through private messages.
        </p>
      </header>

      <Tabs
        tabs={[
          { key: 'all', label: 'All', count: items.length },
          { key: 'lost', label: 'Lost', count: items.filter((i) => i.kind === 'Lost').length },
          { key: 'found', label: 'Found', count: items.filter((i) => i.kind === 'Found').length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {visible.length === 0 ? (
        <EmptyState icon={<LinkIcon size={22} />} title="Nothing here yet" body="When something is lost or found around campus it appears here." />
      ) : (
        <div className="space-y-3">
          {visible.map((i) => (
            <article key={i.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-[15px] font-bold leading-tight">{i.title}</h2>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    i.kind === 'Lost'
                      ? 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral'
                      : 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime'
                  }`}
                >
                  {i.kind}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{i.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                <span>📍 {i.location}</span>
                <span>
                  🗓 {new Date(i.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                {i.isDemo && (
                  <span>
                    <DemoTag compact />
                  </span>
                )}
              </div>
              <button
                onClick={() => claim(i.title)}
                className="touch-target mt-3 w-full rounded-xl bg-violet py-2.5 text-xs font-bold text-plum shadow-violet-glow"
              >
                {i.kind === 'Lost' ? 'Reply — I may have found it' : 'Claim this item'}
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="px-1 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
        {configured
          ? 'Lost and found posting is not available in this release yet. Once it is connected, only a general campus spot will ever be shown — never a private address.'
          : 'Found something? Post it from the clearly-labelled demo feed with a photo and the general spot — never a private address.'}
      </p>
    </div>
  );
}
