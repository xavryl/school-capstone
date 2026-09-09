'use client';

import { useState, useTransition } from 'react';
import { setRequestStatus } from './actions';
import { REQUEST_PIPELINE, STATUS_LABEL, type RequestStatus } from '@/lib/types';

type Row = {
  id: string; reference: string; status: RequestStatus;
  details: string; created_at: string; services: { name: string } | null;
};

export default function RequestRow({ row }: { row: Row }) {
  const [status, setStatus] = useState<RequestStatus>(row.status);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <tr>
      <td className="mono">{row.reference}</td>
      <td>
        {row.services?.name ?? '\u2014'}
        <div className="muted" style={{ fontSize: '.82rem', marginTop: '.2rem' }}>
          {row.details.slice(0, 90)}{row.details.length > 90 ? '\u2026' : ''}
        </div>
        {err && <div className="muted" style={{ color: 'var(--bad)', fontSize: '.8rem' }}>{err}</div>}
      </td>
      <td><span className="pill on">{STATUS_LABEL[status]}</span></td>
      <td>
        <div className="row" style={{ gap: '.4rem', flexWrap: 'nowrap' }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RequestStatus)}
            style={{ minWidth: '9rem' }}
          >
            {REQUEST_PIPELINE.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the student"
            style={{ minWidth: '10rem' }}
          />
          <button
            className="ghost"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await setRequestStatus(row.id, status, note || null);
              setErr(r.error ?? null);
              if (!r.error) setNote('');
            })}
          >
            Save
          </button>
        </div>
      </td>
    </tr>
  );
}
