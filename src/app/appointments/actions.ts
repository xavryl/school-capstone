'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function bookSlot(windowId: number, startsAt: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('book_appointment', {
    p_window: windowId,
    p_start: startsAt,
    p_request: null,
  });
  // book_appointment does not pre-check availability -- the exclusion
  // constraint decides, and its error arrives here already phrased for a
  // student rather than as a Postgres violation.
  if (error) return { error: error.message };
  revalidatePath('/appointments');
  return { ok: true };
}

export async function cancelAppointment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_appointment', { p_id: id });
  if (error) return { error: error.message };
  revalidatePath('/appointments');
  return { ok: true };
}
