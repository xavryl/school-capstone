'use server';

import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';

export async function submitRequest(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in before filing a request.' };

  const { data, error } = await supabase.rpc('submit_request', {
    dept: String(formData.get('department') ?? 'registrar') as Department,
    p_service: Number(formData.get('service_id')),
    p_details: String(formData.get('details') ?? ''),
    p_email: String(formData.get('email') ?? ''),
    p_phone: String(formData.get('phone') ?? '') || null,
    p_when: String(formData.get('preferred_at') ?? '') || null,
  });

  if (error) return { error: error.message };
  return { reference: (data as { reference: string }).reference };
}
