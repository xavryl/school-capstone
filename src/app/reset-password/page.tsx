'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Phase = 'checking' | 'ready' | 'expired' | 'done';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The recovery link carries its token in the URL, which the browser client
  // exchanges for a session on load. That has to happen here rather than on
  // the server: the token arrives in the fragment, which is never sent to it.
  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        settled = true;
        setPhase('ready');
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setPhase('ready');
      }
    });

    // Nothing arrived: the link was already used, or it has expired.
    const t = setTimeout(() => {
      if (!settled) setPhase('expired');
    }, 2500);

    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPhase('done');
  }

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Account</span>
        <h1>Set a new password</h1>
      </header>

      {phase === 'checking' && <p className="lede">Checking your link…</p>}

      {phase === 'expired' && (
        <div className="card stack">
          <h2>That link is no longer valid</h2>
          <p className="muted">
            Reset links can only be used once, and they expire after a while. Ask for a
            fresh one and use the newest email.
          </p>
          <div className="row">
            <Link className="btn" href="/login">Back to sign in</Link>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <form onSubmit={save} className="card stack">
          <label className="field">
            <span className="label">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
            <span className="muted" style={{ fontSize: '.9rem' }}>At least 8 characters.</span>
          </label>

          <label className="field">
            <span className="label">Type it again</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          {error && <p className="notice bad">{error}</p>}

          <div className="row">
            <button disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </div>
        </form>
      )}

      {phase === 'done' && (
        <div className="card stack">
          <h2>Password changed</h2>
          <p className="muted">
            You are signed in on this device. Use the new password next time.
          </p>
          <div className="row">
            <button onClick={() => router.push('/')}>Go to the home page</button>
          </div>
        </div>
      )}
    </main>
  );
}
