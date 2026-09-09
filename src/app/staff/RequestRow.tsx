'use client';

import { useState, useTransition } from 'react';
import { setRequestStatus } from './actions';
import { createClient } from '@/lib/supabase/client';
import { REQUEST_PIPELINE, STATUS_LABEL, type RequestStatus } from '@/lib/types';

export type Attachment = { path: string; filename: string };

type Row = {
  id: string;
  reference: string;
  status: RequestStatus;
  details: string;
  created_at: string;
  services: { name: string } | null;
  attachments: Attachment[];
  department?: string;
};

export default function RequestRow({
  row,
  showDepartment = false,
}: {
  row: Row;
  showDepartment?: boolean;
}) {
  const [status, setStatus] = useState<RequestStatus>(row.status);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Signed on demand rather than at page render: a staff console listing 50
  // requests would otherwise mint hundreds of URLs nobody opens.
  async function open(path: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(path, 300);
    if (error || !data) {
      setErr(error?.message ?? 'Could not open that file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <tr>
      <td className="mono">{row.reference}</td>
      {showDepartment && (
        <td style={{ textTransform: 'capitalize' }}>{row.department}</td>
      )}
      <td>
        {row.services?.name ?? '—'}
        <div className="muted" style={{ fontSize: '.82rem', marginTop: '.2rem' }}>
          {row.details.slice(0, 90)}{row.details.length > 90 ? '…' : ''}
        </div>
        {row.attachments.length > 0 && (
          <div className="row" style={{ gap: '.35rem', marginTop: '.35rem' }}>
            {row.attachments.map((a) => (
              <button
                key={a.path}
                className="ghost attach"
                type="button"
                onClick={() => open(a.path)}
                title={`Open ${a.filename}`}
              >
                {a.filename.length > 22 ? `${a.filename.slice(0, 20)}…` : a.filename}
              </button>
            ))}
          </div>
        )}
        {err && (
          <div className="muted" style={{ color: 'var(--bad)', fontSize: '.8rem' }}>{err}</div>
        )}
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
            onClick={() =>
              start(async () => {
                const r = await setRequestStatus(row.id, status, note || null);
                setErr(r.error ?? null);
                if (!r.error) setNote('');
              })
            }
          >
            Save
          </button>
        </div>
      </td>
    </tr>
  );
}
