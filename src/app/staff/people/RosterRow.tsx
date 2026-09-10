'use client';

import { useState, useTransition } from 'react';
import { removeOfficeStaff } from './actions';

export type RosterPerson = {
  user_id: string;
  full_name: string;
  level: string;
  removable: boolean;
  isSelf: boolean;
};

export default function RosterRow({ person }: { person: RosterPerson }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <tr>
      <td>
        <strong>{person.full_name || 'No name set'}</strong>
        {person.isSelf && <span className="pill on" style={{ marginLeft: '.5rem' }}>You</span>}
        {msg && (
          <div className="muted" style={{ fontSize: '.85rem', color: 'var(--bad)' }}>{msg}</div>
        )}
      </td>

      <td>{person.level}</td>

      <td>
        {person.removable && !confirming && (
          <button className="ghost tiny" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}

        {person.removable && confirming && (
          <span className="row" style={{ gap: '.4rem', flexWrap: 'nowrap' }}>
            <button
              className="tiny"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeOfficeStaff(person.user_id);
                  setMsg(r.error ?? null);
                  setConfirming(false);
                })
              }
            >
              {pending ? 'Removing…' : 'Confirm'}
            </button>
            <button className="ghost tiny" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
