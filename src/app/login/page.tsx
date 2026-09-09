'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signIn, createAccount, sendPasswordReset } from './actions';

type Mode = 'sign-in' | 'create' | 'reset';

// Left-to-right order of the three panels, so the slide direction follows
// where you are going rather than always sweeping the same way.
const ORDER: Record<Mode, number> = { 'sign-in': 0, create: 1, reset: 2 };

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [back, setBack] = useState(false);
  // Carried across the panels so nobody retypes what they already gave us.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [inState, inAction, inPending] = useActionState(signIn, null);
  const [upState, upAction, upPending] = useActionState(createAccount, null);
  const [rsState, rsAction, rsPending] = useActionState(sendPasswordReset, null);

  const offerReset = upState && 'error' in upState && upState.offerReset;

  function go(next: Mode) {
    setBack(ORDER[next] < ORDER[mode]);
    setMode(next);
  }

  // The wrapper is keyed on mode, so it remounts and the animation replays.
  const panel = `auth-panel ${back ? 'from-left' : 'from-right'}`;

  /* ------------------------------------------------------------- reset -- */
  if (mode === 'reset') {
    return (
      <main className="wrap narrow stack-lg">
        <div key="reset" className={panel}>
          <header className="stack">
            <span className="eyebrow">Account</span>
            <h1>Forgot your password?</h1>
            <p className="lede">
              Enter the email address on your account and we will send a link to set a
              new one.
            </p>
          </header>

          <form action={rsAction} className="card stack">
            <label className="field">
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {rsState && 'error' in rsState && <p className="notice bad">{rsState.error}</p>}
            {rsState && 'ok' in rsState && <p className="notice good">{rsState.ok}</p>}

            <div className="row">
              <button disabled={rsPending}>{rsPending ? 'Sending…' : 'Send the link'}</button>
              <button type="button" className="textlink" onClick={() => go('sign-in')}>
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------ create -- */
  if (mode === 'create') {
    return (
      <main className="wrap narrow stack-lg">
        <div key="create" className={panel}>
          <header className="stack">
            <span className="eyebrow">Account</span>
            <h1>Create your account</h1>
            <p className="lede">
              Your name is what the office will see on the requests you file, so use the
              one on your school records.
            </p>
          </header>

          <form action={upAction} className="card stack">
            <label className="field">
              <span className="label">Full name</span>
              <input name="full_name" required autoComplete="name" autoFocus />
            </label>

            <label className="field">
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="muted" style={{ fontSize: '.9rem' }}>At least 8 characters.</span>
            </label>

            {upState && 'error' in upState && <p className="notice bad">{upState.error}</p>}
            {upState && 'ok' in upState && <p className="notice good">{upState.ok}</p>}

            <div className="row">
              <button disabled={upPending}>
                {upPending ? 'Creating…' : 'Create account'}
              </button>
              <button
                type="button"
                className="textlink"
                onClick={() => go(offerReset ? 'reset' : 'sign-in')}
              >
                {offerReset ? 'Reset my password' : 'Back to sign in'}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  /* ----------------------------------------------------------- sign in -- */
  return (
    <main className="wrap narrow stack-lg">
      <div key="sign-in" className={panel}>
        <header className="stack">
          <span className="eyebrow">Account</span>
          <h1>Sign in</h1>
          <p className="lede">
            Students and staff sign in here. Guests do not need an account.
          </p>
        </header>

        <form action={inAction} className="card stack">
          <label className="field">
            <span className="label">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="field-aside">
            <button type="button" className="textlink" onClick={() => go('reset')}>
              Forgot your password?
            </button>
          </div>

          {inState && 'error' in inState && <p className="notice bad">{inState.error}</p>}

          <div className="row">
            <button disabled={inPending}>{inPending ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="ghost" onClick={() => go('create')}>
              Create account
            </button>
          </div>
        </form>
      </div>

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
