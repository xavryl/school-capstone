'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateProfile(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const studentNo = String(formData.get('student_no') ?? '').trim();

  // The "update own profile" policy already scopes this to auth.uid(); the
  // eq() below is belt and braces so a mistake in either layer is not enough
  // on its own to write someone else's row.
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: String(formData.get('full_name') ?? '').trim(),
      student_no: studentNo === '' ? null : studentNo,
    })
    .eq('id', user.id);

  if (error) {
    return {
      error: error.code === '23505'
        ? 'That student number is already registered to another account.'
        : error.message,
    };
  }

  revalidatePath('/profile');
  return { ok: true };
}
