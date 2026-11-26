'use client';

// ============================================================================
// Help & FAQ — plain answers for the questions a new student actually asks,
// organized around the six destinations and the signature features.
// ============================================================================
import Link from 'next/link';
import {
  BedDouble,
  CalendarClock,
  CircleHelp,
  Handshake,
  Orbit,
  Store,
  Users2,
} from 'lucide-react';

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3.5 font-display text-[13px] font-bold [&::-webkit-details-marker]:hidden">
        <CircleHelp size={15} className="shrink-0 text-violet-ink" />
        {q}
        <span className="ml-auto shrink-0 text-campus-text-sec transition group-open:rotate-45 dark:text-campus-dark-sec">+</span>
      </summary>
      <div className="space-y-2 px-3.5 pb-3.5 text-[13px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        {children}
      </div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Help &amp; FAQ</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Everything you need to live your campus well.
        </p>
      </header>

      <section aria-labelledby="help-dest-h" className="space-y-2">
        <h2 id="help-dest-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <Orbit size={15} className="text-violet-ink" /> The six destinations
        </h2>
        <QA q="What are the six main destinations?">
          <p>
            <strong>Home</strong> (feed + Campus Pulse), <strong>Circle</strong> (people, clubs, interest circles,
            activities), <strong>Chats</strong>, <strong>Room</strong> (roommates, hostels, mess),{' '}
            <strong>Marketplace</strong>, and <strong>More</strong> — which holds Department, Academic, Events,
            Opportunities, Lost&nbsp;&amp;&nbsp;Found, Campus Services, Saved, your Campus Passport and Settings.
          </p>
          <p>Tip: press <kbd className="rounded bg-campus-bg px-1.5 py-0.5 font-mono text-[11px] dark:bg-campus-dark-elev">K</kbd> anywhere to search.</p>
        </QA>
        <QA q="How do My Pins work?">
          <p>
            Pins put your favourite secondary destinations first — in the desktop sidebar and on the More page. Drag to
            reorder (press and hold on touch), or use the arrows. Pinning never removes a primary destination, and you
            can reset anytime from{' '}
            <Link href="/more" className="font-bold text-violet-ink hover:underline">
              More → My Pins
            </Link>
            .
          </p>
        </QA>
      </section>

      <section aria-labelledby="help-circle-h" className="space-y-2">
        <h2 id="help-circle-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <Users2 size={15} className="text-violet-ink" /> Circle
        </h2>
        <QA q="What is Make a Plan?">
          <p>
            A plan is a real-life meetup with a purpose — study group, pickup game, lunch crew. You set a participant
            limit, everyone who joins gets a group chat, and the plan page shows who is in. Joining is always voluntary
            and visible only to participants.
          </p>
        </QA>
        <QA q="What is Campus Now?">
          <p>
            A status you post yourself — like &ldquo;studying on the 3rd floor of the library, join me&rdquo; — that
            expires automatically (a couple of hours). It is opt-in every time and never tracks your location.
          </p>
        </QA>
        <QA q="How do Introductions work?">
          <p>
            We suggest a mutual introduction when you and another student share interests or circles and both are open
            to meeting. You both have to accept before a chat opens — declining stays private.
          </p>
        </QA>
        <QA q="What are Temporary Circles?">
          <p>
            A circle for a season, not forever — a trip, a fest committee, a semester project. It fades out when it
            expires, and members can vote to make it permanent if it earns a home in Club Universe.
          </p>
        </QA>
        <QA q="What do club verification levels mean?">
          <ul className="list-disc space-y-1 pl-4">
            <li><strong>Officially Verified</strong> — confirmed by the university.</li>
            <li><strong>Club Verified</strong> — confirmed by the club itself with student sign-off.</li>
            <li><strong>Department Recognized</strong> — recognized by a department.</li>
            <li><strong>Student-Led</strong> — run by students, not yet verified.</li>
            <li><strong>Awaiting</strong> / <strong>Inactive</strong> / <strong>Archived</strong> — pending, resting or graduated clubs.</li>
          </ul>
          <p>University-level verification is never performed by club representatives — only the university verifies.</p>
        </QA>
      </section>

      <section aria-labelledby="help-room-h" className="space-y-2">
        <h2 id="help-room-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <BedDouble size={15} className="text-violet-ink" /> Room
        </h2>
        <QA q="Why do listings only show a general area?">
          <p>
            Safety. Exact addresses and phone numbers are never published. You share details privately with students
            you choose, inside enquiry chats.
          </p>
        </QA>
        <QA q="What is a photo tour?">
          <p>Each room kind (single, shared, mess seat) shows its own labelled photo tour so you can compare like with like.</p>
        </QA>
      </section>

      <section aria-labelledby="help-market-h" className="space-y-2">
        <h2 id="help-market-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <Store size={15} className="text-violet-ink" /> Marketplace
        </h2>
        <QA q="How do I sell something?">
          <p>
            Open Marketplace → <strong>Sell</strong>. Pick one of the nine categories, add photos and a price in ৳.
            Buyers message you through the item itself, so the conversation always keeps the listing context.
          </p>
        </QA>
        <QA q="Meet on campus.">
          <p>
            Meet in public campus spots, in daylight, with a friend. Never share your bank details or OTP with anyone —
            not even someone claiming to be an admin.
          </p>
        </QA>
      </section>

      <section aria-labelledby="help-account-h" className="space-y-2">
        <h2 id="help-account-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <CalendarClock size={15} className="text-violet-ink" /> Honours &amp; Passport
        </h2>
        <QA q="What is Campus Honours?">
          <p>
            Recognition for real contributions — mentoring, organizing, helping — across transparent categories. There
            are no popularity rankings, and you can opt out of appearing in honours entirely from Settings.
          </p>
        </QA>
        <QA q="What goes into my Campus Passport?">
          <p>
            Badges and stamps you earn — circles joined, events attended, contributions made. It holds no sensitive
            documents, just your campus story. Looking for where it lives? It is pinned in{' '}
            <Link href="/more" className="font-bold text-violet-ink hover:underline">
              More
            </Link>
            .
          </p>
        </QA>
      </section>

      <section aria-labelledby="help-safety-h" className="space-y-2">
        <h2 id="help-safety-h" className="flex items-center gap-2 px-1 font-display text-sm font-bold">
          <Handshake size={15} className="text-violet-ink" /> Safety basics
        </h2>
        <QA q="Block, mute or report?">
          <p>
            In any chat: open the conversation menu to mute or block. A Report action sends the item to the
            moderation team — if the reporting library is not connected on this deployment, the app will say so
            clearly and never pretends a report was filed. Blocking and muting work right away.
          </p>
        </QA>
        <QA q="Why does some content look empty?">
          <p>
            Empty sections mean there is nothing there yet — the app never fills gaps with invented students,
            sample listings or fake activity. Some actions stay disabled until their backend support is connected.
          </p>
        </QA>
      </section>
    </div>
  );
}
