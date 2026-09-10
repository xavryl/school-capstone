'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { setRequestStatus, setInquiryStatus } from '../actions';

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

/**
 * Done with it. The two sides of the office finish differently -- a request is
 * completed, an inquiry is closed -- but to whoever is on the counter it is
 * one button, so the difference stays in here.
 */
export async function markCatered(kind: 'request' | 'inquiry', id: string) {
  // Deliberately routed through the existing status actions rather than
  // updating the row here: those write the audit trail, the in-app
  // notification and the email to the person who asked. A raw update would
  // finish the ticket and tell nobody.
  const r =
    kind === 'request'
      ? await setRequestStatus(id, 'completed', null)
      : await setInquiryStatus(id, 'closed');

  if ('error' in r && r.error) return { error: r.error };

  revalidatePath('/staff/inbox');
  revalidatePath('/staff/requests');
  revalidatePath('/staff/inquiries');
  return { ok: true };
}
