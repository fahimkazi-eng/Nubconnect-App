'use client';

// ============================================================================
// NUBCONNECT — feature gate
// ----------------------------------------------------------------------------
// The switches live in the database and are changed only by a Super Admin.
// This component makes the student app actually honour them; a flag that the
// app cannot enforce never appears in the admin UI.
// ============================================================================
import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';
import { useApp } from '@/lib/store';
import type { PlatformFlags } from '@/lib/platform';

export default function FeatureGate({
  flag,
  title,
  body,
  children,
}: {
  flag: keyof Omit<PlatformFlags, 'announcement'>;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const { platformFlags } = useApp();

  if (platformFlags[flag]) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-campus-bg text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border">
        <Construction size={24} />
      </span>
      <h1 className="mt-4 font-display text-xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{body}</p>
      <p className="mt-3 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        An administrator turned this feature off. Nothing you posted here has been deleted.
      </p>
    </div>
  );
}
