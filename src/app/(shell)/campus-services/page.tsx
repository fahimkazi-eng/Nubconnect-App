'use client';

// Campus services — desks and offices students actually need, with hours and
// where to go (never fabricated phone numbers; demo-labelled until the
// backend is connected).
import { Building2, Clock, MapPin, UserRound } from 'lucide-react';
import { DEMO_CAMPUS_SERVICES } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';
import { DemoTag, EmptyState } from '@/components/ui/kit';

export default function CampusServicesPage() {
  // Sample services are a development fixture; a connected campus shows only
  // the desks the university has actually published.
  const services = isBackendConfigured() ? [] : DEMO_CAMPUS_SERVICES;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Campus Services</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          The desks and offices you keep walking past — hours, locations and where to ask.
        </p>
      </header>

      {services.length === 0 ? (
        <EmptyState icon={<Building2 size={22} />} title="No services listed" body="Verified service desks will appear here once the backend is connected." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <article key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-bold">
                  <Building2 size={15} className="shrink-0 text-violet-ink" /> {s.name}
                </h2>
                {s.isDemo && <DemoTag compact />}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{s.description}</p>
              <dl className="mt-3 space-y-1.5 border-t border-campus-border pt-2.5 text-[11px] dark:border-campus-dark-border">
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Location</dt>
                  <dd className="flex items-start gap-2 font-semibold">
                    <MapPin size={12} className="mt-0.5 shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
                    {s.location}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Hours</dt>
                  <dd className="flex items-start gap-2 font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    <Clock size={12} className="mt-0.5 shrink-0" />
                    {s.hours}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Contact point</dt>
                  <dd className="flex items-start gap-2 font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    <UserRound size={12} className="mt-0.5 shrink-0" />
                    {s.contactPoint}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <p className="px-1 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
        Hours can change around exams and holidays — always check department notice boards before a long walk.
      </p>
    </div>
  );
}
