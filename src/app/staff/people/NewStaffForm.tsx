'use client';

import { useState, useTransition } from 'react';
import { createOfficeStaff } from './actions';
import { USERNAME_DOMAIN } from '@/lib/auth';
import type { Department } from '@/lib/types';

type Made = { username: string; email: string; department: Department };

/**
 * Opening an account for a counter clerk. The starting password is typed by
 * the administrator and shown back once, because there is nowhere to email it
 * to: school.local does not resolve. Handing it over in person and having the
 * clerk change it is the intended path.
 */
export default function NewStaffForm({
  offices,
  home,
}: {
  offices: Department[];
  home: Department;
}) {
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="stack"
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await createOfficeStaff(fd);
          if ('error' in r) {
            setError(r.error);
            setMade(null);
            return;
          }
          setMade({ username: r.username, email: r.email, department: r.department });
          // The password stays on screen; only the fields are cleared.
          (document.getElementById('new-staff') as HTMLFormElement | null)?.reset();
        })
      }
      id="new-staff"
    >
      <div className="grid2">
        <label className="field">
          <span className="label">Full name</span>
          <input name="full_name" required placeholder="e.g. Maria Santos" />
        </label>

        <label className="field">
          <span className="label">Username</span>
          <input
            name="username"
            required
            autoComplete="off"
            placeholder="e.g. reg.maria"
            pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{1,30}"
          />
          <small className="muted">
            They sign in with this alone. It becomes {'{username}'}@{USERNAME_DOMAIN}.
          </small>
        </label>

        <label className="field">
          <span className="label">Starting password</span>
          <input
            name="password"
            type="text"
            required
            minLength={8}
            autoComplete="off"
            placeholder="at least 8 characters"
          />
          <small className="muted">
            Shown as you type on purpose — you are reading it out to them, not
            keeping it. They can change it under their profile.
          </small>
        </label>

        {offices.length > 1 ? (
          <label className="field">
            <span className="label">Office</span>
            <select name="department" defaultValue={home}>
              {offices.map((d) => (
                <option key={d} value={d}>
                  {d === 'registrar' ? 'Registrar' : 'Treasury'}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="department" value={home} />
        )}
      </div>

      {error && <p className="notice bad">{error}</p>}

      {made && (
        <p className="notice good">
          <strong>{made.username}</strong> can now sign in to the{' '}
          {made.department === 'registrar' ? 'registrar' : 'treasury'} office as counter
          staff. Give them the username and the password you just set.
        </p>
      )}

      <div className="row">
        <button disabled={pending}>{pending ? 'Creating…' : 'Create staff account'}</button>
      </div>
    </form>
  );
}
