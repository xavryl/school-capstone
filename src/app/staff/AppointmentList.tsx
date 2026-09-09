'use client';

import { useState, useTransition } from 'react';
import { setAppointmentStatus } from './actions';

export type StaffAppointment = {
  id: string;
  starts_at: string;
  status: string;
  window_label: string;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function AppointmentList({ rows }: { rows: StaffAppointment[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="muted">Nothing booked for today.</p>;
  }

  return (
    <div className="stack">
      {err && <p className="notice bad">{err}</p>}
      <div className="scroller">
        <table>
          <thead>
            <tr><th>Time</th><th>Window</th><th>Status</th><th>Mark</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="mono">{time(a.starts_at)}</td>
                <td>{a.window_label}</td>
                <td>
                  <span className={`pill ${a.status === 'attended' ? 'good' : a.status === 'cancelled' ? '' : 'on'}`}>
                    {a.status}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: '.4rem', flexWrap: 'nowrap' }}>
                    <button
                      className="ghost"
                      disabled={pending || a.status !== 'booked'}
                      onClick={() =>
                        start(async () => {
                          const r = await setAppointmentStatus(a.id, 'attended');
                          setErr(r.error ?? null);
                        })
                      }
                    >
                      Attended
                    </button>
                    <button
                      className="ghost"
                      disabled={pending || a.status === 'cancelled'}
                      onClick={() =>
                        start(async () => {
                          const r = await setAppointmentStatus(a.id, 'cancelled');
                          setErr(r.error ?? null);
                        })
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
