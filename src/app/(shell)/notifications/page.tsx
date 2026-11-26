'use client';

// Notifications center — real rows written by the database for this account.
// Category filters and unread badges come from those rows; mark-as-read is
// persisted with an RLS-scoped update and rolled back honestly on failure.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, CheckCheck, RefreshCw } from 'lucide-react';
import { useApp } from '@/lib/store';
import { DemoTag, EmptyState } from '@/components/ui/kit';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

const CATEGORIES: AppNotification['category'][] = [
  'Social',
  'Messages',
  'Communities',
  'Marketplace',
  'Roommates',
  'Events',
  'Academic',
  'System',
];

const CATEGORY_TONE: Record<AppNotification['category'], string> = {
  Social: 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral',
  Messages: 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet',
  Communities: 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime',
  Marketplace: 'bg-sunshine-soft text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  Roommates: 'bg-aqua-soft text-aqua-ink dark:bg-aqua/15 dark:text-aqua',
  Events: 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral',
  Academic: 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet',
  System: 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec',
};

function NotificationCard({
  n,
  onOpen,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
}) {
  const cardCls = `flex items-start gap-3 rounded-2xl p-3.5 ring-1 transition ${
    n.read
      ? 'bg-campus-card ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border'
      : 'bg-violet-soft/70 ring-violet/25 dark:bg-violet-dark-soft/70'
  }`;
  const body = (
    <>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-extrabold ${CATEGORY_TONE[n.category]}`}>
        <Bell size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm ${n.read ? 'font-semibold' : 'font-bold'}`}>{n.title}</p>
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-coral" aria-label="Unread" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{n.body}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
          <span className="rounded-full bg-campus-bg px-1.5 py-0.5 dark:bg-campus-dark-elev">{n.category}</span>
          <span>{timeAgo(n.createdAt)}</span>
          {n.isDemo && <DemoTag compact />}
        </div>
      </div>
    </>
  );

  // A notification without a stored action route stays a plain card — the app
  // never invents a destination the database did not provide.
  if (!n.href) {
    return (
      <div className={cardCls}>
        {body}
        {!n.read && (
          <button
            type="button"
            onClick={() => onOpen(n)}
            className="touch-target shrink-0 rounded-lg bg-campus-bg px-2.5 py-1.5 text-[10px] font-bold text-violet-ink ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-violet dark:ring-campus-dark-border"
          >
            Mark read
          </button>
        )}
      </div>
    );
  }

  return (
    <Link href={n.href} onClick={() => onOpen(n)} className={cardCls}>
      {body}
    </Link>
  );
}

export default function NotificationsPage() {
  const {
    notifications,
    notificationsLoading,
    notificationsError,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    isDemoUser,
  } = useApp();
  const [category, setCategory] = useState<'All' | AppNotification['category']>('All');
  const [markingAll, setMarkingAll] = useState(false);

  const visible = useMemo(
    () => (category === 'All' ? notifications : notifications.filter((n) => n.category === category)),
    [notifications, category],
  );

  const open = (n: AppNotification) => {
    if (!n.read) void markNotificationRead(n.id);
  };

  const markAll = async () => {
    setMarkingAll(true);
    await markAllNotificationsRead();
    setMarkingAll(false);
  };

  const subtitle = notificationsLoading
    ? 'Loading your notifications…'
    : notificationsError
      ? 'Your notifications could not be loaded.'
      : unreadNotificationCount > 0
        ? `${unreadNotificationCount} unread`
        : 'You’re all caught up';

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">Notifications</h1>
          <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
            {subtitle}
            {!notificationsLoading && !notificationsError && (
              isDemoUser
                ? ' — demo records on this device, not account notifications.'
                : ' — records written for your account.'
            )}
          </p>
        </div>
        {unreadNotificationCount > 0 && !notificationsError && (
          <button
            onClick={() => void markAll()}
            disabled={markingAll || notificationsLoading}
            className="touch-target flex shrink-0 items-center gap-1.5 rounded-xl bg-campus-bg px-3.5 py-2 text-xs font-bold ring-1 ring-campus-border transition hover:shadow-lift disabled:opacity-60 dark:bg-campus-dark-card dark:ring-campus-dark-border"
          >
            <CheckCheck size={14} className="text-violet-ink" />
            {markingAll ? 'Saving…' : 'Mark all read'}
          </button>
        )}
      </header>

      {notificationsError ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm font-semibold">{notificationsError}</p>
          <button
            onClick={() => void refreshNotifications()}
            className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
            <button
              onClick={() => setCategory('All')}
              aria-pressed={category === 'All'}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                category === 'All'
                  ? 'bg-violet text-plum ring-violet'
                  : 'bg-campus-card text-campus-text-sec ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
              }`}
            >
              All ({notifications.length})
            </button>
            {CATEGORIES.filter((c) => notifications.some((n) => n.category === c)).map((c) => {
              const count = notifications.filter((n) => n.category === c && !n.read).length;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                    category === c
                      ? 'bg-violet text-plum ring-violet'
                      : 'bg-campus-card text-campus-text-sec ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                  }`}
                >
                  {c}
                  {count > 0 && <span className="ml-1 rounded-full bg-coral-ink px-1.5 text-[9px] text-white">{count}</span>}
                </button>
              );
            })}
          </div>

          {notificationsLoading ? (
            <p className="card p-4 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              Loading your notifications…
            </p>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<BellOff size={22} />}
              title={category === 'All' ? 'No notifications yet' : `Nothing under ${category}`}
              body={
                isDemoUser
                  ? 'Sign in to see notifications written for your account.'
                  : 'Notifications written for your account will appear here.'
              }
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((n) => (
                <li key={n.id}>
                  <NotificationCard n={n} onOpen={open} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
