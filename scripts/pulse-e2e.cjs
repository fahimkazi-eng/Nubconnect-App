// End-to-end check of the Campus Pulse data layer against the live project.
// Signs in as a QA student, exercises availability + activities + RPCs, and
// removes everything it created. Never prints keys.
//
//   $env:NUB_QA_EMAIL="qa.student@nub.edu.bd"
//   $env:NUB_QA_PASSWORD="…"
//   node scripts/pulse-e2e.cjs
//
// The account must be linked to a university (user_universities). Credentials
// are read from the environment so no password is committed to the repo.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

(async () => {
  const email = process.env.NUB_QA_EMAIL;
  const password = process.env.NUB_QA_PASSWORD;
  if (!email || !password) {
    console.error('Set NUB_QA_EMAIL and NUB_QA_PASSWORD (see supabase/qa/create_test_user.sql).');
    process.exit(1);
  }

  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw new Error('sign-in failed: ' + authErr.message);
  const userId = auth.user.id;
  console.log('signed in as', userId.slice(0, 8) + '…');

  const { data: uu, error: uuErr } = await supabase
    .from('user_universities')
    .select('university_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (uuErr) throw new Error('university lookup failed: ' + uuErr.message);
  if (!uu?.university_id) throw new Error('QA account is not linked to a university');
  const universityId = uu.university_id;
  console.log('university ok');

  // 1. Publish availability
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const upsert = await supabase.from('campus_now_statuses').upsert(
    {
      university_id: universityId,
      user_id: userId,
      activity: 'Free to chat',
      status_key: 'free_to_chat',
      spot_note: 'Central Library',
      note: 'Pulse e2e check',
      on_campus: true,
      open_to_connect: true,
      visibility: 'university',
      posted_at: new Date().toISOString(),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (upsert.error) throw new Error('publish availability failed: ' + upsert.error.message);
  console.log('availability published');

  // 2. Read it back with the same embed the app uses
  const read = await supabase
    .from('campus_now_statuses')
    .select(
      `id, user_id, activity, spot_note, note, posted_at, expires_at, open_to_connect, status_key, on_campus, visibility, campus_area_id,
       profiles:campus_now_statuses_user_id_fkey(id, username, display_name, avatar_url, is_verified_student, semester_label, interests, departments:department_id(code))`,
    )
    .gt('expires_at', new Date().toISOString());
  if (read.error) throw new Error('availability read failed: ' + read.error.message);
  const mineRead = (read.data || []).find((r) => r.user_id === userId);
  console.log('availability read:', read.data.length, 'visible rows; mine =', Boolean(mineRead));
  if (mineRead) console.log('   name =', mineRead.profiles?.display_name ?? 'MISSING PROFILE JOIN');

  // 3. Create an activity with a Campus Pulse category and request-joining
  const create = await supabase
    .from('activity_plans')
    .insert({
      university_id: universityId,
      created_by: userId,
      title: 'Pulse e2e coffee',
      description: 'Temporary row created by a verification script.',
      category: 'coffee_break',
      meeting_spot: 'Campus cafeteria',
      starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      participant_limit: 4,
      join_mode: 'request',
      status: 'open',
    })
    .select('id')
    .single();
  if (create.error) throw new Error('create activity failed: ' + create.error.message);
  const planId = create.data.id;
  console.log('activity created', planId.slice(0, 8) + '…');

  // 4. Read the activities with the app's exact embed
  const activities = await supabase
    .from('activity_plans')
    .select(
      `id, title, description, category, meeting_spot, starts_at, duration_minutes, participant_limit, join_mode, status, created_by, note,
       host:profiles!activity_plans_created_by_fkey(id, username, display_name, avatar_url),
       activity_plan_participants(user_id, profiles:profiles!activity_plan_participants_user_id_fkey(id, username, display_name, avatar_url)),
       activity_plan_requests(id, user_id, status, note, profiles:profiles!activity_plan_requests_user_id_fkey(id, username, display_name, avatar_url))`,
    )
    .eq('status', 'open')
    .order('starts_at', { ascending: true });
  if (activities.error) throw new Error('activities read failed: ' + activities.error.message);
  const mineActivity = (activities.data || []).find((a) => a.id === planId);
  console.log('activities read:', activities.data.length, 'rows; mine =', Boolean(mineActivity));
  if (mineActivity) console.log('   host join =', mineActivity.host?.display_name ?? 'MISSING HOST JOIN');

  // 5. join_activity must refuse a request-only activity
  const refused = await supabase.rpc('join_activity', { p_plan: planId });
  console.log('join_activity on request-only activity ->', refused.data, refused.error ? 'ERR ' + refused.error.message : '');

  // 6. Switch to open joining and join
  await supabase.from('activity_plans').update({ join_mode: 'open' }).eq('id', planId);
  const joined = await supabase.rpc('join_activity', { p_plan: planId });
  console.log('join_activity on open activity ->', joined.data, joined.error ? 'ERR ' + joined.error.message : '');

  const roster = await supabase
    .from('activity_plan_participants')
    .select('user_id')
    .eq('plan_id', planId);
  console.log('participants after join:', roster.data?.length ?? 'ERR', roster.error?.message ?? '');

  // 7. Clear my availability
  const cleared = await supabase.from('campus_now_statuses').delete().eq('user_id', userId);
  console.log('availability cleared:', !cleared.error, cleared.error?.message ?? '');

  // Cleanup: remove the test activity (cascades participants/requests)
  const cleanup = await supabase.from('activity_plans').delete().eq('id', planId);
  console.log('test activity removed:', !cleanup.error, cleanup.error?.message ?? '');

  await supabase.auth.signOut();
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
