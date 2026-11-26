'use client';

// ============================================================================
// Edit profile — real writes to public.profiles through authorized media storage.
// Account ≠ NUB Verified: verification is requested here but decided only by
// an authorized university reviewer. Demo mode never pretends to save.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import {
  friendlyAuthError,
  validateDisplayName,
  validateUsername,
  type ProfileRow,
} from '@/lib/auth';
import { uploadMedia } from '@/lib/storage/client';
import { Avatar, VerifiedBadge } from '@/components/ui/kit';

const inputCls =
  'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';
const labelCls =
  'mb-1 block text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec';

type Department = { id: string; code: string; name: string };

export default function EditProfilePage() {
  const { user, isDemoUser, authLoading, pushToast, refreshProfile } = useApp();
  const configured = isBackendConfigured();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [semester, setSemester] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [interests, setInterests] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<'idle' | 'pending' | 'requested'>('idle');

  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!configured || isDemoUser) {
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, username, display_name, avatar_url, cover_url, primary_university_id, department_id, semester_label, bio, interests, is_verified_student, is_suspended',
        )
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;
      if (data) {
        const row = data as unknown as ProfileRow;
        setProfile(row);
        setDisplayName(row.display_name);
        setUsername(row.username);
        setBio(row.bio ?? '');
        setSemester(row.semester_label ?? '');
        setDepartmentId(row.department_id ?? '');
        setInterests((row.interests ?? []).join(', '));
        setAvatarUrl(row.avatar_url ?? null);
        setCoverUrl(row.cover_url ?? null);
      }

      const { data: deps } = await supabase
        .from('departments')
        .select('id, code, name')
        .order('name');
      if (active && deps) setDepartments(deps as Department[]);

      const { data: pending } = await supabase
        .from('student_verifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (active) setVerification(pending ? 'pending' : 'idle');

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [configured, isDemoUser, user.id]);

  const interestList = useMemo(
    () =>
      interests
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean)
        .slice(0, 8),
    [interests],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const nameError = validateDisplayName(displayName);
    if (nameError) return setError(nameError);
    const usernameError = validateUsername(username);
    if (usernameError) return setError(usernameError);
    if (bio.length > 280) return setError('Bio must be 280 characters or fewer.');

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        semester_label: semester.trim() || null,
        department_id: departmentId || null,
        interests: interestList,
      })
      .eq('id', user.id);
    setSaving(false);

    if (updateError) {
      if (updateError.code === '23505') return setError('That username is already taken. Try another.');
      return setError(friendlyAuthError(updateError.message));
    }

    await refreshProfile();
    pushToast('Profile updated', 'success');
  };

  const upload = async (kind: 'avatar' | 'cover', file: File) => {
    setError(null);
    const maxBytes = kind === 'avatar' ? 5 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return setError('Use a JPEG, PNG or WebP image.');
    }
    if (file.size > maxBytes) {
      return setError(`Image must be ${kind === 'avatar' ? '5' : '8'} MB or smaller.`);
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setUploading(kind);
    const uploaded = await uploadMedia(supabase, { kind, file });
    if (!uploaded.ok) {
      setUploading(null);
      return setError(friendlyAuthError(uploaded.error));
    }

    const column = kind === 'avatar' ? 'avatar_url' : 'cover_url';
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ [column]: uploaded.data.url })
      .eq('id', user.id);
    setUploading(null);

    if (profileError) return setError(friendlyAuthError(profileError.message));

    if (kind === 'avatar') setAvatarUrl(uploaded.data.url);
    else setCoverUrl(uploaded.data.url);
    await refreshProfile();
    pushToast(kind === 'avatar' ? 'Profile photo updated' : 'Cover photo updated', 'success');
  };

  const requestVerification = async () => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!profile?.primary_university_id) {
      return setError('Your university is not linked to this account yet. Contact a campus administrator.');
    }
    if (!user.email) {
      return setError('Add an email to your account before requesting verification.');
    }

    const { error: insertError } = await supabase.from('student_verifications').insert({
      user_id: user.id,
      university_id: profile.primary_university_id,
      verification_method: 'manual_admin_review',
      institutional_email: user.email,
      status: 'pending',
    });
    if (insertError) return setError(friendlyAuthError(insertError.message));
    setVerification('requested');
    pushToast('Verification request sent to university staff', 'success');
  };

  // -------------------------------------------------------------------------
  // Honest states
  // -------------------------------------------------------------------------
  if (!configured) {
    return (
      <div className="space-y-4">
        <BackLink />
        <header className="px-1">
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">Edit profile</h1>
          <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
            Profile editing activates when student accounts are connected.
          </p>
        </header>
        <div className="card space-y-3 p-4">
          <p className="flex items-start gap-2 rounded-xl bg-sunshine-soft p-3 text-xs font-semibold leading-relaxed text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/30">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              This deployment has no Supabase project configured. We won’t pretend to save changes
              to a browser-only copy of your profile.
            </span>
          </p>
          <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, apply the migrations,
            then create an account to edit your real profile, photos and privacy settings.
          </p>
          <Link href={`/profile/${user.username}`} className="text-xs font-bold text-violet-ink hover:underline dark:text-violet">
            Back to the demo profile
          </Link>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-campus-text-sec dark:text-campus-dark-sec">
        <Loader2 size={16} className="animate-spin" /> Loading your profile…
      </div>
    );
  }

  if (isDemoUser) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="card p-4">
          <p className="text-sm font-bold">Sign in to edit your profile</p>
          <p className="mt-1 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Accounts are configured, but this session is still showing the demo identity.
          </p>
          <Link href="/auth/login" className="mt-3 inline-flex text-xs font-bold text-violet-ink hover:underline dark:text-violet">
            Go to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Edit profile</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          You control what other students see. Only you can edit this profile.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-coral-soft px-3 py-2.5 text-xs font-semibold leading-relaxed text-coral-ink ring-1 ring-coral/30 dark:bg-coral/10 dark:text-coral">
          {error}
        </p>
      )}

      {/* Account vs NUB Verified */}
      <section className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
          <BadgeCheck size={15} className="text-violet-ink" /> Account & verification
        </h2>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-campus-text-sec dark:text-campus-dark-sec">Signed in as</span>
            <span className="truncate font-semibold">{user.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-campus-text-sec dark:text-campus-dark-sec">Account</span>
            <span className="rounded-full bg-violet-soft px-2.5 py-1 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
              Student account
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-campus-text-sec dark:text-campus-dark-sec">NUB Verified</span>
            {user.isVerified ? (
              <VerifiedBadge label="NUB Verified" />
            ) : (
              <span className="rounded-full bg-campus-bg px-2.5 py-1 text-[10px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
                Not verified
              </span>
            )}
          </div>
        </div>

        {!user.isVerified && (
          <div className="mt-3 border-t border-campus-border pt-3 dark:border-campus-dark-border">
            {verification === 'requested' ? (
              <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-lime-ink dark:text-lime">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                Request received. University staff will review it — this can take time.
              </p>
            ) : verification === 'pending' ? (
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                A verification request is already pending with university staff.
              </p>
            ) : (
              <>
                <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  NUB Verified is a separate review by Northern University Bangladesh staff. A
                  student account alone never grants the badge.
                </p>
                <button
                  type="button"
                  onClick={requestVerification}
                  className="touch-target mt-2 rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum shadow-violet-glow"
                >
                  Request NUB verification
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Photos */}
      <section className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
          <Camera size={15} className="text-violet-ink" /> Photos
        </h2>

        <div className="relative mb-4 overflow-hidden rounded-2xl">
          <div className="relative h-28 bg-violet-soft dark:bg-violet-dark-soft">
            {coverUrl ? (
              <img src={coverUrl} alt="Your cover" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] font-semibold text-violet-ink dark:text-violet">
                No cover photo yet
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={uploading !== null}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-xl bg-black/55 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur disabled:opacity-50"
          >
            {uploading === 'cover' ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            Change cover
          </button>
        </div>

        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Your profile" className="h-16 w-16 rounded-full object-cover ring-2 ring-violet/40" />
          ) : (
            <Avatar seed={user.id} name={user.name} size={64} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Profile photo</p>
            <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              JPEG, PNG or WebP — up to 5 MB. Use a photo you own.
            </p>
          </div>
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            disabled={uploading !== null}
            className="touch-target shrink-0 rounded-xl bg-campus-bg px-3 py-2 text-[11px] font-bold ring-1 ring-campus-border disabled:opacity-50 dark:bg-campus-dark-elev dark:ring-campus-dark-border"
          >
            {uploading === 'avatar' ? <Loader2 size={13} className="animate-spin" /> : 'Change'}
          </button>
        </div>

        <input
          ref={avatarInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('avatar', file);
            e.target.value = '';
          }}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('cover', file);
            e.target.value = '';
          }}
        />
      </section>

      {/* Details */}
      <form onSubmit={save} className="card space-y-3 p-4">
        <h2 className="font-display text-sm font-bold">Profile details</h2>

        <div>
          <label htmlFor="p-name" className={labelCls}>
            Display name
          </label>
          <input id="p-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} required />
        </div>

        <div>
          <label htmlFor="p-username" className={labelCls}>
            Username
          </label>
          <input id="p-username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} required />
        </div>

        <div>
          <label htmlFor="p-bio" className={labelCls}>
            Bio
          </label>
          <textarea
            id="p-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="What are you studying, building or looking for?"
            className={inputCls}
          />
          <p className="mt-1 text-right text-[10px] text-campus-text-sec dark:text-campus-dark-sec">{bio.length}/280</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="p-semester" className={labelCls}>
              Semester
            </label>
            <input
              id="p-semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. 7th Semester (Tri-Semester)"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="p-department" className={labelCls}>
              Department
            </label>
            <select
              id="p-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={inputCls}
              disabled={departments.length === 0}
            >
              <option value="">Not set</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="p-interests" className={labelCls}>
            Interests
          </label>
          <input
            id="p-interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Machine Learning, Campus Photography, UI Design"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            Comma-separated, up to 8. Shown on your profile.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-plum shadow-violet-glow disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Your privacy choices live in{' '}
        <Link href="/settings" className="font-bold text-violet-ink hover:underline dark:text-violet">
          Settings
        </Link>
        . NUBCONNECT never publishes your phone number or exact address.
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/settings" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline dark:text-violet">
      <ArrowLeft size={14} /> Back to Settings
    </Link>
  );
}
