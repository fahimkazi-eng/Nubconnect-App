'use client';

// Campus Highlights — horizontal photo cards.
//
// The cards are real: they are the photographs published by verified pages
// (the official NUB Connect Page and club pages), each one linking back to
// the album it came from. When nothing has been published yet the section is
// simply absent rather than filled with sample photographs.
import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';

interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  photo: string;
  sourceUrl?: string;
}

export default function Highlights() {
  const scroller = useRef<HTMLDivElement>(null);
  const { posts } = useApp();
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: 'smooth' });

  const highlights = useMemo<Highlight[]>(() => {
    // Without a configured backend there are no real page photographs to
    // show; the section stays absent instead of displaying sample imagery.
    if (!isBackendConfigured()) return [];
    return posts
      .filter((p) => !p.isDemo && p.media.length > 0 && p.publisher)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: p.title ?? p.publisher!.name,
        subtitle: p.publisher!.name,
        photo: p.media[0]!,
        sourceUrl: p.sourceUrl,
      }));
  }, [posts]);

  if (highlights.length === 0) return null;

  return (
    <section aria-label="Campus highlights" className="relative">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-display text-[15px] font-bold sm:text-base">Campus Highlights</h2>
        <div className="hidden gap-1 sm:flex">
          <button
            aria-label="Scroll highlights left"
            onClick={() => scrollBy(-300)}
            className="glass touch-target flex items-center justify-center rounded-full"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Scroll highlights right"
            onClick={() => scrollBy(300)}
            className="glass touch-target flex items-center justify-center rounded-full"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={scroller} className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {highlights.map((h) =>
          // A photograph with a source opens the album it came from.
          h.sourceUrl ? (
            <a
              key={h.id}
              href={h.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[4/5] w-36 shrink-0 snap-start overflow-hidden rounded-2xl sm:w-44"
            >
              <img
                src={h.photo}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#211B35]/85 via-[#211B35]/20 to-transparent" />
              <span className="absolute left-2 top-2 rounded-full bg-white/85 px-1.5 py-px text-[9px] font-bold text-plum backdrop-blur-sm dark:bg-plum/80 dark:text-white">
                nub.ac.bd
              </span>
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="line-clamp-2 font-display text-[13px] font-bold leading-snug text-white">
                  {h.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-white/75">{h.subtitle}</p>
              </div>
            </a>
          ) : (
            <Link
              key={h.id}
              href="/page/nub-connect"
              className="group relative aspect-[4/5] w-36 shrink-0 snap-start overflow-hidden rounded-2xl sm:w-44"
            >
              <img
                src={h.photo}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#211B35]/85 via-[#211B35]/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="line-clamp-2 font-display text-[13px] font-bold leading-snug text-white">
                  {h.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-white/75">{h.subtitle}</p>
              </div>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
