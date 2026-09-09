'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState =
  | { error: string; offerReset?: boolean }
  | { ok: string }
  | null;

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

/**
 * One box for both cases. Try to sign in; if the credentials are refused, try
 * to register the same address.
 *
 * Supabase deliberately returns the same "Invalid login credentials" whether
 * the account does not exist or the password is wrong -- otherwise the form
 * becomes a way to discover who has an account here. The sign-up attempt is
 * what tells the two apart: registering an address that already exists comes
 * back as a success with an empty `identities` array, which means the account
 * was real and the password was simply wrong.
 */
export async function continueWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password) return { error: 'Enter your email and a password.' };

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (!signInError) {
    revalidatePath('/', 'layout');
    redirect('/');
  }

  if (signInError.message.toLowerCase().includes('email not confirmed')) {
    return {
      error:
        'This account exists but the email address has not been confirmed yet. ' +
        'Open the link we sent you, then come back and sign in.',
    };
  }

  if (!signInError.message.toLowerCase().includes('invalid login credentials')) {
    return { error: signInError.message };
  }

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/login`,
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return { error: 'That password does not match this email address.', offerReset: true };
    }
    return { error: signUpError.message };
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'That password does not match this email address.', offerReset: true };
  }

  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/');
  }

  return {
    ok:
      `We have created your account and sent a confirmation link to ${email}. ` +
      'Open it, then come back and sign in with the same password.',
  };
}

export async function sendPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter the email address on your account.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/reset-password`,
  });

  if (error) return { error: error.message };

  // Deliberately the same answer whether or not the address is registered,
  // for the same reason the sign-in error is vague.
  return {
    ok: `If ${email} has an account, a link to set a new password is on its way.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
