'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { continueWithEmail, sendPasswordReset } from './actions';

export default function LoginPage() {
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in');
  const [state, action, pending] = useActionState(continueWithEmail, null);
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordReset, null);

  const offerReset = state && 'offerReset' in state && state.offerReset;

  if (mode === 'reset') {
    return (
      <main className="wrap narrow stack-lg">
        <header className="stack">
          <span className="eyebrow">Account</span>
          <h1>Forgot your password?</h1>
          <p className="lede">
            Enter the email address on your account and we will send you a link to set a
            new one.
          </p>
        </header>

        <form action={resetAction} className="card stack">
          <label className="field">
            <span className="label">Email</span>
            <input name="email" type="email" required autoComplete="email" autoFocus />
          </label>

          {resetState && 'error' in resetState && (
            <p className="notice bad">{resetState.error}</p>
          )}
          {resetState && 'ok' in resetState && (
            <p className="notice good">{resetState.ok}</p>
          )}

          <div className="row">
            <button disabled={resetPending}>
              {resetPending ? 'Sending…' : 'Send the link'}
            </button>
            <button type="button" className="ghost" onClick={() => setMode('sign-in')}>
              Back to sign in
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Account</span>
        <h1>Sign in</h1>
        <p className="lede">
          Enter your school email and a password. If you have not used this before, we
          will create your account.
        </p>
      </header>

      <form action={action} className="card stack">
        <label className="field">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>

        <label className="field">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
          />
          <span className="muted" style={{ fontSize: '.9rem' }}>
            At least 8 characters. If this is a new account, this becomes your password.
          </span>
        </label>

        <label className="field">
          <span className="label">Full name</span>
          <input name="full_name" autoComplete="name" placeholder="Only needed for a new account" />
        </label>

        {state && 'error' in state && <p className="notice bad">{state.error}</p>}
        {state && 'ok' in state && <p className="notice good">{state.ok}</p>}

        <div className="row">
          <button disabled={pending}>{pending ? 'Checking…' : 'Continue'}</button>
          <button
            type="button"
            className="ghost"
            onClick={() => setMode('reset')}
          >
            {offerReset ? 'Reset my password' : 'Forgot your password?'}
          </button>
        </div>
      </form>

      <div className="aside-card">
        <h3>Not a student or employee?</h3>
        <p className="muted small">
          You do not need an account. Send a guest inquiry and you will get a reference
          number to follow the reply.
        </p>
        <Link className="btn ghost tiny" href="/inquiry">Send a guest inquiry</Link>
      </div>
    </main>
  );
}
