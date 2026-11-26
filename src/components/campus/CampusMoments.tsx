'use client';

// ============================================================================
// CAMPUS MOMENTS — a photo-first view of photos students actually published.
// This is not Stories: the stories schema does not exist yet, so nothing here
// pretends to be an ephemeral story. Every tile is a real feed photo with a
// real author and caption, and empty means empty.
// ============================================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Camera, ChevronRight } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Modal, EmptyState } from '@/components/ui/kit';
import type { Post } from '@/lib/types';

/** Intentional magazine rhythm: no two consecutive tiles share a shape. */
const SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
];

export default function CampusMoments() {
  const { posts } = useApp();
  const [open, setOpen] = useState<Post | null>(null);

  const moments = useMemo(
    () => posts.filter((p) => p.media && p.media.length > 0).slice(0, 6),
    [posts],
  );

  return (
    <section aria-labelledby="campus-moments-heading" className="card overflow-hidden p-0">
      <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="editorial-kicker text-violet-ink dark:text-violet">From the feed</p>
          <h2 id="campus-moments-heading" className="mt-1 font-display text-lg font-extrabold tracking-tight">
            Campus <span className="font-editorial font-normal italic">moments</span>
          </h2>
        </div>
        <Link href="/home" className="flex items-center gap-0.5 text-[11px] font-bold text-violet-ink hover:underline dark:text-violet">
          All posts <ChevronRight size={12} />
        </Link>
      </div>

      {moments.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState
            icon={<Camera size={22} />}
            title="No campus photos yet"
            body="When students publish photos, they will appear here. Nothing is generated or borrowed to fill the grid."
          />
        </div>
      ) : (
        <div className="grid auto-rows-[72px] grid-cols-3 gap-1.5 px-4 pb-4 sm:auto-rows-[86px]">
          {moments.map((post, i) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setOpen(post)}
              aria-label={`Open photo by ${post.authorName}`}
              className={`group relative overflow-hidden rounded-xl bg-campus-bg dark:bg-campus-dark-elev ${SPANS[i % SPANS.length]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.media[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {post.authorName}
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.authorName || 'Campus moment'} wide>
        {open && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.media[0]} alt="" className="max-h-[60dvh] w-full rounded-2xl object-contain" />
            {(open.title || open.body) && (
              <div>
                {open.title && <p className="font-display text-base font-extrabold">{open.title}</p>}
                <p className="mt-1 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{open.body}</p>
              </div>
            )}
            <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              {open.authorRole} · {open.originBadge}
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
