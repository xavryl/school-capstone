'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffGate } from '@/lib/staff';
import { toEmail, isValidUsername } from '@/lib/auth';
import type { Department } from '@/lib/types';

/**
 * Assigning an office is what turns an ordinary account into staff. The RLS
 * policy on `staff` already restricts this to administrators; the check here
 * is so the UI can say why rather than silently doing nothing.
 */
export async function setStaffRole(
  userId: string,
  department: Department | 'none',
  role: 'staff' | 'head',
  isAdmin: boolean,
) {
  const gate = await getStaffGate();
  if (gate.state !== 'ok' || !gate.ctx.isAdmin) {
    return { error: 'Only an administrator can change staff roles.' };
  }

  // Nobody should be able to strip their own administrator rights and lock
  // everyone out of this page.
  if (userId === gate.ctx.userId && (department === 'none' || !isAdmin)) {
    return { error: 'You cannot remove your own administrator access.' };
  }

  const supabase = await createClient();

  if (department === 'none') {
    const { error } = await supabase.from('staff').delete().eq('user_id', userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('staff')
      .upsert({ user_id: userId, department, role, is_admin: isAdmin }, { onConflict: 'user_id' });
    if (error) return { error: error.message };
  }

  revalidatePath('/staff/people');
  return { ok: true };
}

export type NewStaffResult =
  | { error: string }
  | { ok: true; username: string; email: string; department: Department };

/**
 * An office administrator opening an account for one of their own counter
 * staff. Deliberately narrow: the office is theirs, the level is always
 * 'staff', and is_admin is never set. A head cannot mint a second head, and
 * cannot put anybody into the other office -- those remain the system
 * administrator's to give.
 *
 * Creating the login needs the service key, because it writes to auth.users.
 * That is the whole reason this is a server action and not a database
 * function: the key must never reach a browser.
 */
export async function createOfficeStaff(formData: FormData): Promise<NewStaffResult> {
  const gate = await getStaffGate();
  if (gate.state !== 'ok' || !gate.ctx.canManage) {
    return { error: 'Only an office administrator can open a staff account.' };
  }
  const { ctx } = gate;

  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const wanted = String(formData.get('department') ?? ctx.home) as Department;

  // An administrator may be looking at either office; a head is pinned to
  // their own whatever the form says.
  const department: Department = ctx.isAdmin
    ? (ctx.departments.includes(wanted) ? wanted : ctx.home)
    : ctx.home;

  if (!isValidUsername(username)) {
    return {
      error:
        'Usernames are 2–31 characters: lowercase letters, numbers, dot, dash or underscore, starting with a letter or number.',
    };
  }
  if (!fullName) return { error: 'Give the person a name, so colleagues know whose account this is.' };
  if (password.length < 8) {
    return { error: 'Set a starting password of at least 8 characters. They can change it later.' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY is not set on the server, so accounts cannot be created here. Add the key, or create the account in the Supabase dashboard.',
    };
  }

  const email = toEmail(username);

  // Confirmed on creation: school.local is not a routable domain, so a
  // confirmation link would never arrive.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    const message = error?.message ?? 'The account could not be created.';
    return {
      error: /already|registered|exists/i.test(message)
        ? `Somebody already signs in as ${username}. Pick another username.`
        : message,
    };
  }

  // The handle_new_user trigger writes the profile row; this only matters if
  // the trigger has not been installed on this database.
  await admin
    .from('profiles')
    .upsert({ id: data.user.id, full_name: fullName }, { onConflict: 'id' });

  const { error: staffError } = await admin
    .from('staff')
    .upsert(
      { user_id: data.user.id, department, role: 'staff', is_admin: false },
      { onConflict: 'user_id' },
    );

  if (staffError) {
    // A login with no office is worse than no login at all: it can sign in
    // and see nothing, and the username is taken. Undo it.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `The account was rolled back: ${staffError.message}` };
  }

  revalidatePath('/staff/people');
  return { ok: true, username, email, department };
}

/**
 * Taking somebody off the counter. The login survives -- it simply stops
 * being staff, which is the reversible half of the operation.
 */
export async function removeOfficeStaff(userId: string) {
  const gate = await getStaffGate();
  if (gate.state !== 'ok' || !gate.ctx.canManage) {
    return { error: 'Only an office administrator can do that.' };
  }
  const { ctx } = gate;

  if (userId === ctx.userId) return { error: 'You cannot remove your own access.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' };
  }

  const { data: row } = await admin
    .from('staff')
    .select('department, role, is_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (!row) return { error: 'That account is not staff.' };
  if (!ctx.departments.includes(row.department as Department)) {
    return { error: 'That person works in the other office.' };
  }
  // A head runs their counter staff, not their peers.
  if (!ctx.isAdmin && (row.is_admin || row.role === 'head')) {
    return { error: 'Only a system administrator can remove another administrator.' };
  }

  const { error } = await admin.from('staff').delete().eq('user_id', userId);
  if (error) return { error: error.message };

  revalidatePath('/staff/people');
  return { ok: true };
}
