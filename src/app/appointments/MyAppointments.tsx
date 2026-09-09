'use client';

import { useState, useTransition } from 'react';
import { cancelAppointment } from './actions';

type Row = {
  id: string;
  starts_at: string;
  status: string;
  service_windows: { label: string; department: string } | null;
};

export default function MyAppointments({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="muted">You have no upcoming appointments.</p>;
  }

  return (
    <div className="stack">
      {err && <p className="notice bad">{err}</p>}
      {rows.map((a) => (
        <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
          <span>
            <strong>
              {new Date(a.starts_at).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </strong>
            <span className="muted"> &middot; {a.service_windows?.label ?? 'Window'}</span>
          </span>
          <span className="row" style={{ gap: '.5rem' }}>
            <span className={`pill ${a.status === 'booked' ? 'on' : ''}`}>{a.status}</span>
            {a.status === 'booked' && (
              <button
                className="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await cancelAppointment(a.id);
                    setErr(r.error ?? null);
                  })
                }
              >
                Cancel
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
