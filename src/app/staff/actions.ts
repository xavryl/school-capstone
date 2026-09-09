'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { broadcastQueue } from '@/lib/supabase/admin';
import type { Department, QueueState, RequestStatus } from '@/lib/types';

/**
 * Promotes the next waiting ticket at this window, then pushes the change to
 * the lobby television. The RPC re-checks staff membership server-side, so a
 * forged request from the browser cannot call a queue for another department.
 */
export async function callNext(dept: Department, windowId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('call_next', { dept, p_window: windowId });
  if (error) return { error: error.message };
  if (!data) return { error: 'Nobody is waiting in this queue.' };

  const ticket = data as { number: string; window_id: number };
  const { data: win } = await supabase
    .from('service_windows').select('label').eq('id', ticket.window_id).single();

  await broadcastQueue(dept, { number: ticket.number, window: win?.label ?? 'the window' });
  revalidatePath('/staff');
  return { ok: ticket.number };
}

export async function setTicketState(ticketId: string, state: QueueState, dept: Department) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ticket_state', {
    p_ticket: ticketId, p_state: state,
  });
  if (error) return { error: error.message };

  await broadcastQueue(dept, { refresh: true });
  revalidatePath('/staff');
  return { ok: true };
}

export async function setRequestStatus(
  requestId: string, status: RequestStatus, note: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_request_status', {
    p_request: requestId, p_status: status, p_note: note,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true };
}

export async function respondToInquiry(inquiryId: string, response: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_to_inquiry', {
    p_id: inquiryId, p_response: response,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true };
}
