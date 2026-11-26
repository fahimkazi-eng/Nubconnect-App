'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { DEMO_DEPARTMENTS, DEMO_FACULTIES } from '@/lib/demo/dataset';
import { loadDepartments } from '@/lib/data';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { campusScene } from '@/lib/photos';
import { EmptyState, VerifiedBadge } from '@/components/ui/kit';
import type { Department } from '@/lib/types';

export default function DepartmentPage() {
  const configured = isBackendConfigured();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    let active = true;
    if (!configured) {
      setDepartments(DEMO_DEPARTMENTS);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void loadDepartments(client).then((loaded) => {
      if (!active) return;
      setDepartments(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [configured]);

  const faculties = useMemo(() => {
    if (!configured) return DEMO_FACULTIES;
    return [...new Set(departments.map((d) => d.faculty).filter(Boolean))].sort();
  }, [configured, departments]);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Department</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          {configured
            ? 'Academic communities from the university directory.'
            : `Your campus communities — ${DEMO_DEPARTMENTS.length} departments across ${DEMO_FACULTIES.length} faculties.`}
        </p>
      </header>

      {loading && (
        <div className="card p-6 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Loading departments…
        </div>
      )}

      {!loading && departments.length === 0 && (
        <EmptyState
          icon={<Building2 size={22} />}
          title={configured ? 'No departments published yet' : 'No departments available'}
          body={
            configured
              ? 'The university directory has not published department records for this campus.'
              : 'Connect a university backend to see the real department directory.'
          }
        />
      )}

      {!loading &&
        faculties.map((faculty) => {
          const depts = departments.filter((d) => d.faculty === faculty);
          if (depts.length === 0) return null;
          return (
            <section key={faculty} aria-label={faculty}>
              <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-sm font-bold text-campus-text-sec dark:text-campus-dark-sec">
                <Building2 size={15} />
                {faculty}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {depts.map((d) => (
                  <Link
                    key={d.id ?? d.code}
                    href={`/department/${d.code.toLowerCase()}`}
                    className="card overflow-hidden p-0 transition hover:shadow-lift"
                  >
                    <div className="relative h-20">
                      <img
                        src={campusScene(d.code, 800, 260)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-[13px] font-bold leading-snug">{d.name}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-violet-ink">{d.code}</p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="mt-1 shrink-0 text-campus-text-sec dark:text-campus-dark-sec"
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <VerifiedBadge label={d.verificationStatus} />
                        <span className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                          {d.semesterSystem}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                        {d.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
