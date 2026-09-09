'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState =
  | { error: string; unmatched?: boolean; offerReset?: boolean }
  | { ok: string }
  | null;

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

const ALREADY_REGISTERED =
  'That email already has an account, so the password does not match it.';

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    revalidatePath('/', 'layout');
    redirect('/');
  }

  const message = error.message.toLowerCase();

  if (message.includes('email not confirmed')) {
    return {
      error:
        'This account exists but its email address has not been confirmed yet. ' +
        'Open the link we sent you, then sign in again.',
    };
  }

  // Supabase answers the same way whether the account is missing or the
  // password is wrong -- otherwise this form becomes a way to discover who
  // has an account here. So we cannot say which it is; we offer both routes
  // and let the sign-up attempt settle it.
  if (message.includes('invalid login credentials')) {
    return {
      error: 'We could not sign you in with that email and password.',
      unmatched: true,
    };
  }

  return { error: error.message };
}

export async function createAccount(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!fullName) return { error: 'Enter your full name as it appears on your records.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/login`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: ALREADY_REGISTERED, offerReset: true };
    }
    return { error: error.message };
  }

  // Registering an address that already exists comes back as a success with
  // an empty identities array. That is what tells us the account was real and
  // the password was simply wrong.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: ALREADY_REGISTERED, offerReset: true };
  }

  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/');
  }

  return {
    ok:
      `Account created. We have sent a confirmation link to ${email} — open it, ` +
      'then sign in with the password you just chose.',
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

  // Deliberately the same answer whether or not the address is registered.
  return { ok: `If ${email} has an account, a link to set a new password is on its way.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
