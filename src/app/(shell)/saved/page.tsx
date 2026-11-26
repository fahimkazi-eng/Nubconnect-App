'use client';

// Saved — posts, rooms and marketplace items the signed-in student kept.
// For a real account the ids and records come from RLS-protected tables; the
// offline demo dataset is only used when no backend is configured.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Heart, Home, MessageSquare } from 'lucide-react';
import { DEMO_MARKETPLACE, DEMO_POSTS, DEMO_ROOMS } from '@/lib/demo/dataset';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { loadSavedContent, type SavedContent } from '@/lib/saved';
import { EmptyState, Tabs } from '@/components/ui/kit';
import { taka } from '@/lib/format';

const EMPTY_CONTENT: SavedContent = { posts: [], rooms: [], products: [] };

export default function SavedPage() {
  const { saved, user, isDemoUser, toggleSavePost, toggleSaveRoom, toggleSaveProduct } = useApp();
  const [tab, setTab] = useState('posts');
  const [content, setContent] = useState<SavedContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(false);
  const configured = isBackendConfigured();

  const savedKey = useMemo(
    () => JSON.stringify([saved.posts, saved.rooms, saved.products]),
    [saved.posts, saved.rooms, saved.products],
  );

  useEffect(() => {
    let active = true;

    if (isDemoUser) {
      // No credentials means an explicitly labelled offline demo. A configured
      // deployment with no session must not display someone else's samples.
      setContent(
        configured
          ? EMPTY_CONTENT
          : {
              posts: DEMO_POSTS.filter((p) => saved.posts.includes(p.id)),
              rooms: DEMO_ROOMS.filter((r) => saved.rooms.includes(r.id)),
              products: DEMO_MARKETPLACE.filter((p) => saved.products.includes(p.id)),
            },
      );
      return () => {
        active = false;
      };
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setContent(EMPTY_CONTENT);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void loadSavedContent(supabase, user.id, saved).then((loaded) => {
      if (!active) return;
      setContent(loaded);
      setLoading(false);
    });

    return () => {
      active = false;
    };
    // savedKey is the stable value of the id lists used in the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, isDemoUser, savedKey, user.id]);

  const { posts, rooms, products } = content;
  const needsSignIn = configured && isDemoUser;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Saved</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          {needsSignIn
            ? 'Sign in to see the posts, rooms and items you saved.'
            : configured
              ? 'Your private reading list, stored with your NUB Connect account.'
              : 'Your reading list of campus life — kept privately on this device.'}
        </p>
      </header>

      <Tabs
        tabs={[
          { key: 'posts', label: 'Posts', count: posts.length },
          { key: 'rooms', label: 'Rooms', count: rooms.length },
          { key: 'products', label: 'Products', count: products.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading && (
        <div className="card p-6 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Loading your saved items…
        </div>
      )}

      {!loading && tab === 'posts' &&
        (posts.length > 0 ? (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="card flex items-start gap-3 p-3.5">
                {p.media[0] && (
                  <img src={p.media[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.body}</p>
                  <p className="mt-1 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    {p.authorName} • {p.circleSlug ? p.circleSlug : p.audience}
                  </p>
                </div>
                <button
                  onClick={() => void toggleSavePost(p.id)}
                  aria-label="Remove from saved"
                  className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec"
                >
                  <Bookmark size={15} className="fill-current" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bookmark size={22} />}
            title="No saved posts yet"
            body="Tap Save on any post in your feed and it will wait for you here."
          />
        ))}

      {!loading && tab === 'rooms' &&
        (rooms.length > 0 ? (
          <div className="space-y-2">
            {rooms.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 p-3.5">
                {r.photos[0] && (
                  <img src={r.photos[0].uri} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/roommates/${r.id}`} className="line-clamp-1 text-sm font-bold hover:underline">
                    {r.title}
                  </Link>
                  <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    📍 {r.area} • {taka(r.rent)}/month
                  </p>
                </div>
                <button
                  onClick={() => void toggleSaveRoom(r.id)}
                  aria-label="Remove from saved"
                  className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec"
                >
                  <Heart size={15} className="fill-current" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Home size={22} />}
            title="No saved rooms yet"
            body="Tap the heart on a listing in Find Roommates to keep it here."
          />
        ))}

      {!loading && tab === 'products' &&
        (products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="card overflow-hidden p-0">
                <Link href={`/marketplace/${p.id}`}>
                  <div className="relative aspect-square">
                    {p.photos[0] ? (
                      <img src={p.photos[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-campus-text-sec">
                        No photo
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-2.5">
                  <Link href={`/marketplace/${p.id}`}>
                    <p className="line-clamp-2 min-h-[2.4em] font-display text-[13px] font-bold leading-tight">
                      {p.title}
                    </p>
                    <p className="mt-1 font-display text-[15px] font-extrabold text-violet-ink">
                      {taka(p.price)}
                    </p>
                  </Link>
                  <button
                    onClick={() => void toggleSaveProduct(p.id)}
                    className="touch-target mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-campus-bg py-1.5 text-[11px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec"
                  >
                    <Heart size={11} className="fill-current" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<MessageSquare size={22} />}
            title="No saved items yet"
            body="Tap the heart on any marketplace listing to keep it here."
          />
        ))}
    </div>
  );
}
