'use client';

import { useActionState } from 'react';
import { signIn, signUp } from './actions';

export default function LoginForms({ next }: { next: string }) {
  const [inState, inAction, inPending] = useActionState(signIn, null);
  const [upState, upAction, upPending] = useActionState(signUp, null);

  return (
    <>
      {next !== '/request' && (
        <p className="notice">
          Sign in and we will take you straight back to what you were doing.
        </p>
      )}

      <form action={inAction} className="card stack">
        <h2>School member</h2>
        <input type="hidden" name="next" value={next} />
        <label className="field">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {inState?.error && <p className="notice bad">{inState.error}</p>}
        <div className="row">
          <button disabled={inPending}>{inPending ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>

      <form action={upAction} className="card stack">
        <h2>Create an account</h2>
        <label className="field">
          <span className="label">Full name</span>
          <input name="full_name" required />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {upState?.error && <p className="notice bad">{upState.error}</p>}
        {upState?.ok && <p className="notice good">{upState.ok}</p>}
        <div className="row">
          <button className="ghost" disabled={upPending}>
            {upPending ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </>
  );
}
