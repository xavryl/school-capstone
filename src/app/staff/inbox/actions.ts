'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function claim(kind: 'request' | 'inquiry', id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    kind === 'request' ? 'claim_request' : 'claim_inquiry',
    kind === 'request' ? { p_request: id } : { p_id: id },
  );
  if (error) return { error: error.message };
  revalidatePath('/staff/inbox');
  return { ok: true };
}

/** Handing work to someone, or releasing it back to the pool with null. */
export async function assign(
  kind: 'request' | 'inquiry',
  id: string,
  userId: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    kind === 'request' ? 'assign_request' : 'assign_inquiry',
    kind === 'request'
      ? { p_request: id, p_user: userId }
      : { p_id: id, p_user: userId },
  );
  if (error) return { error: error.message };
  revalidatePath('/staff/inbox');
  revalidatePath('/staff/requests');
  revalidatePath('/staff/inquiries');
  return { ok: true };
}
