'use client';

// ============================================================================
// Privacy & safety — a plain-language summary of how NUBCONNECT handles
// student data, consent and safety. Reflects the real product rules:
// general-area-only rooms, consent-gated messaging, opt-in ephemeral Campus
// Now, photo-only media, and device-local preferences in demo mode.
// ============================================================================
import Link from 'next/link';
import { Eye, Lock, MapPin, MessageCircle, ShieldCheck, Timer } from 'lucide-react';
import { isBackendConfigured } from '@/lib/supabase';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
        {icon} {title}
      </h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Privacy &amp; safety</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          The short version: your campus life stays yours.
        </p>
      </header>

      <Section icon={<ShieldCheck size={15} className="text-violet-ink" />} title="Who can reach you">
        <p>
          You decide who can discover you and who can message you — both are adjustable any time in{' '}
          <Link href="/settings" className="font-bold text-violet-ink hover:underline">
            Settings → Privacy
          </Link>
          . Conversation requests never reveal your phone number, and nobody starts a chat without your consent when your
          policy requires it.
        </p>
      </Section>

      <Section icon={<MapPin size={15} className="text-violet-ink" />} title="Rooms stay general-area only">
        <p>
          Room listings show the general area — never an exact address, and never a phone number. Interested students
          message you inside NUBCONNECT; anything sensitive is shared later, in private, at your pace.
        </p>
      </Section>

      <Section icon={<Timer size={15} className="text-violet-ink" />} title="Campus Now is opt-in and ephemeral">
        <p>
          Campus Now statuses are a check-in (&ldquo;at the library, join me&rdquo;), not a tracker: you post one yourself,
          it expires automatically, and there is no location tracking anywhere in the app.
        </p>
      </Section>

      <Section icon={<MessageCircle size={15} className="text-violet-ink" />} title="Introductions need both sides">
        <p>
          Campus Introductions pair you only when both people are open to it. Declining is silent — the other student is
          never told you were suggested to them.
        </p>
      </Section>

      <Section icon={<Eye size={15} className="text-violet-ink" />} title="Photos only">
        <p>
          NUBCONNECT is photo-only by design — there is no video anywhere in the product, and upload flows only accept
          images.
        </p>
      </Section>

      <Section icon={<Lock size={15} className="text-violet-ink" />} title="Where your data lives">
        <p>
          {isBackendConfigured()
            ? 'Your account data lives in your university’s Supabase project, isolated per university, with row-level security on every table. Reports and moderation actions are logged.'
            : 'This build runs in demo mode: preferences (theme, pins, saved items) are stored only on this device, and all campus content is clearly labelled DEMO — it never represents real students.'}
        </p>
        <p>You can block or report anyone from their profile or a conversation — reports go straight to moderation.</p>
      </Section>
    </div>
  );
}
