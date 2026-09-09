'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { broadcastQueue } from '@/lib/supabase/admin';
import { sendMail, statusEmail } from '@/lib/email';
import type { Department, InquiryStatus, QueueState, RequestStatus } from '@/lib/types';

/**
 * Promotes the next waiting ticket at this window, then pushes the change to
 * the lobby television. call_next() re-checks staff membership server-side, so
 * a forged request from the browser cannot call another department's queue.
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
    p_ticket: ticketId,
    p_state: state,
  });
  if (error) return { error: error.message };

  await broadcastQueue(dept, { refresh: true });
  revalidatePath('/staff');
  return { ok: true };
}

export async function setRequestStatus(
  requestId: string,
  status: RequestStatus,
  note: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_request_status', {
    p_request: requestId,
    p_status: status,
    p_note: note,
  });
  if (error) return { error: error.message };

  // The in-app notification is written inside the function. Email goes out
  // here instead, so a mail outage can never roll back the status change.
  const req = data as { reference: string; contact_email: string } | null;
  if (req?.contact_email) {
    const { subject, text } = statusEmail(req.reference, status, note);
    await sendMail({ to: req.contact_email, subject, text });
  }

  revalidatePath('/staff');
  return { ok: true };
}

export async function respondToInquiry(inquiryId: string, response: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('respond_to_inquiry', {
    p_id: inquiryId,
    p_response: response,
  });
  if (error) return { error: error.message };

  const inq = data as { reference: string; email: string; subject: string } | null;
  if (inq?.email) {
    await sendMail({
      to: inq.email,
      subject: `Re: ${inq.subject} (${inq.reference})`,
      text: `${response}\n\nYou can view this reply at /track/${inq.reference}\n`,
    });
  }

  revalidatePath('/staff');
  return { ok: true };
}

export async function setInquiryStatus(inquiryId: string, status: InquiryStatus) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_inquiry_status', {
    p_id: inquiryId,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true };
}

export async function setAppointmentStatus(id: string, status: 'attended' | 'cancelled') {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_appointment_status', {
    p_id: id,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true };
}
