'use server';

import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';

/**
 * Guests are unauthenticated. submit_inquiry is SECURITY DEFINER, so the anon
 * role never needs insert rights on the inquiries table itself.
 */
export async function submitInquiry(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('submit_inquiry', {
    dept: String(formData.get('department') ?? 'registrar') as Department,
    p_name: String(formData.get('name') ?? ''),
    p_email: String(formData.get('email') ?? ''),
    p_subject: String(formData.get('subject') ?? ''),
    p_body: String(formData.get('body') ?? ''),
  });

  if (error) return { error: error.message };
  return { reference: data as string };
}
