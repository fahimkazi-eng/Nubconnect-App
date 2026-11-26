// ============================================================================
// NUBCONNECT — Content media persistence helpers.
//
// Companion to migration 020_content_media.sql. Calls SECURITY DEFINER RPCs
// that enforce the authorization rules server-side:
//   • set_department_media — departments: university admins + department admins
//   • set_group_media      — circles: the circle owner or university admins
//
// Never writes cover/avatar columns directly from the client. If a caller
// lacks authority the RPC raises; we surface that verbatim.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MediaUpdateResult {
  ok: boolean;
  error: string | null;
}

function friendlyMessage(message: string | null | undefined, fallback: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('not signed in')) return 'Sign in to manage this media.';
  if (m.includes('university administrators') && m.includes('department')) {
    return 'Only university administrators can change department media.';
  }
  if (m.includes('circle owner') || m.includes('circle media')) {
    return 'Only the circle owner or a university administrator can change circle media.';
  }
  if (m.includes('department not found')) return 'This department could not be found.';
  if (m.includes('circle not found')) return 'This circle could not be found.';
  if (m.includes('could not find the function') || m.includes('schema cache')) {
    return 'Media management is not connected on this deployment yet — ask an administrator to apply migration 020.';
  }
  return message && message.trim() ? message : fallback;
}

export type DepartmentMediaUpdate = {
  departmentId: string;
  /** Pass a URL to set; pass null to remove; omit to leave unchanged. */
  logoUrl?: string | null;
  coverUrl?: string | null;
};

export async function setDepartmentMedia(
  client: SupabaseClient,
  input: DepartmentMediaUpdate,
): Promise<MediaUpdateResult> {
  const { error } = await client.rpc('set_department_media', {
    p_department_id: input.departmentId,
    p_logo_url: typeof input.logoUrl === 'string' ? input.logoUrl : null,
    p_cover_url: typeof input.coverUrl === 'string' ? input.coverUrl : null,
    p_remove_logo: input.logoUrl === null,
    p_remove_cover: input.coverUrl === null,
  });
  return error
    ? { ok: false, error: friendlyMessage(error.message, 'Could not save the department media.') }
    : { ok: true, error: null };
}

export type GroupMediaUpdate = {
  groupId: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
};

export async function setGroupMedia(
  client: SupabaseClient,
  input: GroupMediaUpdate,
): Promise<MediaUpdateResult> {
  const { error } = await client.rpc('set_group_media', {
    p_group_id: input.groupId,
    p_avatar_url: typeof input.avatarUrl === 'string' ? input.avatarUrl : null,
    p_cover_url: typeof input.coverUrl === 'string' ? input.coverUrl : null,
    p_remove_avatar: input.avatarUrl === null,
    p_remove_cover: input.coverUrl === null,
  });
  return error
    ? { ok: false, error: friendlyMessage(error.message, 'Could not save the circle media.') }
    : { ok: true, error: null };
}
