'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Only same-site paths are honoured. A leading "/" is not enough on its own:
 * "//evil.example" is also a valid URL, and would send someone straight off
 * the site immediately after they typed their password.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/request';
}

export async function signIn(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    options: { data: { full_name: String(formData.get('full_name') ?? '') } },
  });
  if (error) return { error: error.message };
  return { ok: 'Account created. If email confirmation is on, check your inbox before signing in.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
