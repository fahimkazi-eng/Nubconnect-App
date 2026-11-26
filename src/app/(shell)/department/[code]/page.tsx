'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  MessageCircle,
  Users,
} from 'lucide-react';
import {
  DEMO_CLUBS,
  DEMO_DEPARTMENTS,
  DEMO_EVENTS,
  DEMO_PEOPLE,
  DEMO_POSTS,
} from '@/lib/demo/dataset';
import {
  loadDepartmentDetail,
  type DepartmentCourse,
  type DepartmentDetail,
  type DepartmentDiscussion,
  type DepartmentEvent,
  type DepartmentResource,
} from '@/lib/departments';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { setDepartmentMedia } from '@/lib/media';
import OrgMediaManager from '@/components/media/OrgMediaManager';
import { useApp } from '@/lib/store';
import { campusScene } from '@/lib/photos';
import { Avatar, DemoTag, EmptyState, Tabs, VerifiedBadge } from '@/components/ui/kit';
import PostCard from '@/components/feed/PostCard';
import { pluralize } from '@/lib/format';
import type { Club, Person, Post } from '@/lib/types';

const EMPTY_DETAIL: Omit<DepartmentDetail, 'department'> = {
  posts: [] as Post[],
  students: [] as Person[],
  clubs: [] as Club[],
  courses: [] as DepartmentCourse[],
  events: [] as DepartmentEvent[],
  discussions: [] as DepartmentDiscussion[],
  resources: [] as DepartmentResource[],
};

export default function DepartmentDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const configured = isBackendConfigured();
  const { user, isDemoUser, startConversation, isFollowing, toggleFollow } = useApp();
  const [tab, setTab] = useState('community');
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(configured);
  // Only a university/department administrator may manage branding. Detected
  // via the admin_role_names RPC — never from a frontend flag.
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);

  useEffect(() => {
    if (!configured || isDemoUser || !user.id) {
      setIsDepartmentAdmin(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void (async () => {
      try {
        const { data } = await supabase.rpc('admin_role_names');
        const roles = Array.isArray(data) ? (data as string[]) : [];
        setIsDepartmentAdmin(
          roles.some((role) =>
            ['super_admin', 'admin', 'department_admin', 'university_admin', 'platform_super_admin'].includes(role),
          ),
        );
      } catch {
        setIsDepartmentAdmin(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, isDemoUser, user.id]);

  useEffect(() => {
    let active = true;
    if (!configured) {
      const department = DEMO_DEPARTMENTS.find(
        (d) => d.code.toLowerCase() === code.toLowerCase(),
      );
      if (department) {
        setDetail({
          ...EMPTY_DETAIL,
          department,
          posts: DEMO_POSTS.filter((p) => p.departmentCode === department.code).slice(0, 6),
          students: DEMO_PEOPLE.filter((p) => p.departmentCode === department.code),
          clubs: DEMO_CLUBS.filter(
            (c) =>
              c.name.toLowerCase().includes(department.code.toLowerCase()) ||
              (department.code === 'CSE' &&
                ['nubcc', 'it-club', 'cse-club', 'robotics'].includes(c.slug)) ||
              (department.code === 'EEE' && ['eee-club', 'robotics'].includes(c.slug)) ||
              (department.code === 'TEXTILE' && c.slug.startsWith('textile')) ||
              (department.code === 'PHARM' && c.slug.startsWith('pharm')) ||
              (department.code === 'LAW' && c.slug.startsWith('law')),
          ),
          events: DEMO_EVENTS.slice(0, 2).map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            startTime: e.startTime ?? null,
            venue: e.venue ?? '',
            sourceUrl: null,
          })),
        });
      } else {
        setDetail(null);
      }
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

    void loadDepartmentDetail(client, code, isDemoUser ? null : user.id).then((loaded) => {
      if (!active) return;
      setDetail(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [code, configured, isDemoUser, user.id]);

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
        Loading department…
      </div>
    );
  }
  if (!detail) notFound();

  const { department } = detail;
  const { posts, students, clubs, courses, events, discussions, resources } = detail;

  return (
    <div>
      <Link
        href="/department"
        className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline"
      >
        <ArrowLeft size={14} /> All departments
      </Link>

      <div className="card overflow-hidden p-0">
        <div className="relative h-32 sm:h-44">
          <img
            src={department.coverUrl ?? campusScene(department.code, 1200, 440)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#211B35]/70 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-end gap-3">
              {department.logoUrl && (
                <img
                  src={department.logoUrl}
                  alt={`${department.name} logo`}
                  className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover ring-2 ring-white/70"
                />
              )}
              <div className="min-w-0">
                <h1 className="font-display text-lg font-extrabold text-white drop-shadow sm:text-2xl">
                  {department.name}
                </h1>
                <p className="text-[11px] font-semibold text-white/85">
                  {department.code} • {department.faculty}
                </p>
              </div>
            </div>
            <VerifiedBadge label={department.verificationStatus} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-4">
          <span className="rounded-full bg-campus-bg px-2.5 py-1 text-[11px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {department.semesterSystem}
          </span>
          <span className="rounded-full bg-campus-bg px-2.5 py-1 text-[11px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {pluralize(department.programs.length, 'program')}
          </span>
          <span className="rounded-full bg-campus-bg px-2.5 py-1 text-[11px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {pluralize(students.length, 'student')} visible
          </span>
          {!configured && <DemoTag compact />}
        </div>
      </div>

      {isDepartmentAdmin && department.id && (
        <div className="mt-4">
          <OrgMediaManager
            title="Department branding"
            subtitle="Visible only to university and department administrators. Saved through the authorized covers bucket and the department media RPC (migration 020)."
            canEdit
            fields={[
              {
                key: 'cover',
                title: 'Cover image',
                hint: 'Wide image shown at the top of the department page.',
                aspectLabel: '16:6',
                canvasWidth: 1280,
                canvasHeight: 480,
                currentUrl: department.coverUrl ?? null,
              },
              {
                key: 'logo',
                title: 'Department logo',
                hint: 'Square image shown on the department page and directory.',
                aspectLabel: '1:1',
                canvasWidth: 512,
                canvasHeight: 512,
                currentUrl: department.logoUrl ?? null,
              },
            ]}
            onSave={async (key, _file, uploadedUrl) => {
              const supabase = getSupabaseBrowserClient();
              if (!supabase || !department.id) return 'Department data is not available.';
              const result = await setDepartmentMedia(supabase, {
                departmentId: department.id,
                logoUrl: key === 'logo' ? uploadedUrl : undefined,
                coverUrl: key === 'cover' ? uploadedUrl : undefined,
              });
              if (!result.ok) return result.error ?? 'Could not save the department media.';
              setDetail((prev) =>
                prev
                  ? {
                      ...prev,
                      department: {
                        ...prev.department,
                        logoUrl: key === 'logo' ? uploadedUrl : prev.department.logoUrl,
                        coverUrl: key === 'cover' ? uploadedUrl : prev.department.coverUrl,
                      },
                    }
                  : prev,
              );
              return null;
            }}
          />
        </div>
      )}

      <div className="mt-4">
        <Tabs
          tabs={[
            { key: 'community', label: 'Community', count: posts.length },
            { key: 'students', label: 'Students', count: students.length },
            { key: 'clubs', label: 'Clubs', count: clubs.length },
            { key: 'courses', label: 'Courses', count: courses.length },
            { key: 'faculty', label: 'Faculty' },
            { key: 'events', label: 'Events', count: events.length },
            { key: 'discussions', label: 'Groups', count: discussions.length },
            { key: 'resources', label: 'Resources', count: resources.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-3 space-y-3">
        {tab === 'community' &&
          (posts.length > 0 ? (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <EmptyState
              icon={<MessageCircle size={22} />}
              title={`No ${department.code} posts yet`}
              body="Community posts from this department will appear here when students publish them."
            />
          ))}

        {tab === 'students' &&
          (students.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {students.map((s) => (
                <div key={s.id} className="card p-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${s.username}`}>
                      <Avatar seed={s.id} name={s.name} size={44} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${s.username}`}
                        className="font-display text-sm font-bold hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                        {s.semester}
                        {s.isVerified && ' • ✓'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-xs text-campus-text-sec dark:text-campus-dark-sec">
                    {s.intro}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => toggleFollow(s.id)}
                      className={`touch-target flex-1 rounded-xl py-2 text-xs font-bold ${
                        isFollowing(s.id)
                          ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                          : 'bg-violet text-plum shadow-violet-glow'
                      }`}
                    >
                      {isFollowing(s.id) ? '✓ Following' : 'Follow'}
                    </button>
                    <button
                      onClick={() =>
                        startConversation({
                          personId: s.id,
                          title: s.name,
                          initialNote: `Hi! Fellow ${department.code} student here.`,
                        })
                      }
                      className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-3 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                      aria-label={`Message ${s.name}`}
                    >
                      <MessageCircle size={15} className="text-violet-ink" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No students visible yet"
              body="Students appear here when they choose to be discoverable in this department."
            />
          ))}

        {tab === 'clubs' &&
          (clubs.length > 0 ? (
            <div className="space-y-2">
              {clubs.map((c) => (
                <Link
                  key={c.slug}
                  href={`/clubs/${c.slug}`}
                  className="card flex items-center gap-3 p-3 transition hover:shadow-lift"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-aqua font-display text-xs font-extrabold text-plum">
                    {c.name.replace(/[^A-Z]/g, '').slice(0, 2) || 'CL'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {c.verificationStatus} • {pluralize(c.memberCount, 'member')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No clubs linked yet"
              body="Recognized organizations for this department will appear here."
            />
          ))}

        {tab === 'courses' &&
          (courses.length > 0 ? (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3.5">
                  <GraduationCap size={17} className="shrink-0 text-violet-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.title}</p>
                    <p className="font-mono text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {c.code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-bold dark:bg-campus-dark-elev">
                    {c.creditHours} cr
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<GraduationCap size={22} />}
              title="No courses published"
              body={
                configured
                  ? 'The academic office has not published courses for this department.'
                  : 'Connect the university backend to see official course records.'
              }
            />
          ))}

        {tab === 'faculty' && (
          <div className="card p-4 text-sm">
            <h2 className="font-display font-bold">Faculty information</h2>
            <p className="mt-1.5 leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {department.officialContact
                ? `Department contact: ${department.officialContact}`
                : 'No public department contact has been published.'}
            </p>
            <a
              href={department.sourceUrl || 'https://www.nub.ac.bd/'}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-aqua-ink hover:underline dark:text-aqua"
            >
              Official program information (nub.ac.bd) ↗
            </a>
            <p className="mt-2 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              NUBCONNECT never fabricates teacher bios or statistics — faculty details come only
              from official university sources.
            </p>
          </div>
        )}

        {tab === 'events' &&
          (events.length > 0 ? (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="card flex items-center gap-3 p-3.5">
                  <Calendar size={17} className="shrink-0 text-violet-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{e.title}</p>
                    <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {[e.date, e.startTime, e.venue].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  {e.sourceUrl && (
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[11px] font-bold text-aqua-ink hover:underline"
                    >
                      Source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar size={22} />}
              title="No department events published"
              body="Events listed by this department will appear here."
            />
          ))}

        {tab === 'discussions' &&
          (discussions.length > 0 ? (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {discussions.map((d) => (
                <div key={d.id} className="p-3.5">
                  <p className="text-sm font-semibold">{d.name}</p>
                  {d.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-campus-text-sec dark:text-campus-dark-sec">
                      {d.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No department groups yet"
              body="Student-created study and project groups for this department will appear here."
            />
          ))}

        {tab === 'resources' &&
          (resources.length > 0 ? (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3.5">
                  <GraduationCap size={16} className="shrink-0 text-violet-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {[r.courseCode, r.type, r.attribution].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <a
                    href={r.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] font-bold text-aqua-ink hover:underline"
                  >
                    Open ↗
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<GraduationCap size={22} />}
              title="No shared resources yet"
              body="Attributed syllabus, notes and lab manuals contributed by students will appear here."
            />
          ))}
      </div>
    </div>
  );
}
