'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function signIn(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect('/request');
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
