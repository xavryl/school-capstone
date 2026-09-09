'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { USERNAME_DOMAIN, toDisplayName, isValidUsername } from '@/lib/auth';

/**
 * Changing a username means changing the account's email address, because
 * that is the only identity Supabase Auth actually stores. For an office
 * account on the internal domain that is invisible -- nothing is delivered
 * there. For a real address it is not, so we say what will happen.
 */
export default function CredentialsCard({ email }: { email: string }) {
  const router = useRouter();
  const isOfficeAccount = email.endsWith(`@${USERNAME_DOMAIN}`);

  const [username, setUsername] = useState(toDisplayName(email));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const next = username.trim().toLowerCase();
    if (next === toDisplayName(email)) {
      setMsg({ kind: 'bad', text: 'That is already your username.' });
      return;
    }
    if (isOfficeAccount && !isValidUsername(next)) {
      setMsg({
        kind: 'bad',
        text: 'Use 2 to 31 characters: letters, numbers, dots, dashes or underscores.',
      });
      return;
    }

    setBusy('Saving…');
    const supabase = createClient();
    const nextEmail = next.includes('@') ? next : `${next}@${USERNAME_DOMAIN}`;
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setBusy('');

    if (error) {
      setMsg({ kind: 'bad', text: error.message });
      return;
    }

    setMsg({
      kind: 'ok',
      text: isOfficeAccount
        ? `Signed in as ${next} from now on.`
        : `We have sent a confirmation link to ${nextEmail}. The change takes effect once you open it.`,
    });
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg({ kind: 'bad', text: 'Use at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setMsg({ kind: 'bad', text: 'The two passwords do not match.' });
      return;
    }

    setBusy('Saving…');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy('');

    if (error) {
      setMsg({ kind: 'bad', text: error.message });
      return;
    }
    setPassword('');
    setConfirm('');
    setMsg({ kind: 'ok', text: 'Password changed. Use the new one next time you sign in.' });
  }

  return (
    <div className="card stack">
      <div className="stack" style={{ gap: '.35rem' }}>
        <h2>Sign-in details</h2>
        <p className="muted small">
          You sign in as <strong>{toDisplayName(email)}</strong>
          {isOfficeAccount && ' — an office account, so there is no inbox behind it.'}
        </p>
      </div>

      {busy && <p className="notice">{busy}</p>}
      {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}

      <form onSubmit={saveUsername} className="stack" style={{ gap: '.6rem' }}>
        <label className="field">
          <span className="label">{isOfficeAccount ? 'Username' : 'Email address'}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <div className="row">
          <button className="ghost tiny" disabled={busy !== ''}>
            {isOfficeAccount ? 'Change username' : 'Change email'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="stack" style={{ gap: '.6rem' }}>
        <div className="grid2">
          <label className="field">
            <span className="label">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span className="label">Type it again</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="row">
          <button className="ghost tiny" disabled={busy !== '' || password === ''}>
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}
