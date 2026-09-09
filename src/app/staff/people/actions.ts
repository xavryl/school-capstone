'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getStaffGate } from '@/lib/staff';
import type { Department } from '@/lib/types';

/**
 * Assigning an office is what turns an ordinary account into staff. The RLS
 * policy on `staff` already restricts this to administrators; the check here
 * is so the UI can say why rather than silently doing nothing.
 */
export async function setStaffRole(
  userId: string,
  department: Department | 'none',
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
      .upsert({ user_id: userId, department, is_admin: isAdmin }, { onConflict: 'user_id' });
    if (error) return { error: error.message };
  }

  revalidatePath('/staff/people');
  return { ok: true };
}
