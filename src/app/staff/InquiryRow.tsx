'use client';

import { useState, useTransition } from 'react';
import { respondToInquiry, setInquiryStatus } from './actions';
import type { InquiryStatus } from '@/lib/types';

type Row = {
  id: string;
  reference: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: InquiryStatus;
  response: string | null;
  created_at: string;
};

export default function InquiryRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(row.response ?? '');
  const [status, setStatus] = useState<InquiryStatus>(row.status);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>
          <strong>{row.subject}</strong>
          <span className="muted"> &middot; {row.name}</span>
          <div className="label" style={{ marginTop: '.2rem' }}>
            {row.reference} &middot; {new Date(row.created_at).toLocaleDateString()}
          </div>
        </span>
        <span className="row" style={{ gap: '.5rem' }}>
          <span className={`pill ${status === 'closed' ? 'good' : 'warn'}`}>{status}</span>
          <button className="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Open'}
          </button>
        </span>
      </div>

      {open && (
        <>
          <div className="stack" style={{ gap: '.4rem' }}>
            <span className="label">Their message</span>
            <p className="muted">{row.body}</p>
            <span className="label">Reply to {row.email}</span>
          </div>

          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write the answer the guest will receive by email."
          />

          {msg && <p className="notice good">{msg}</p>}

          <div className="row">
            <button
              disabled={pending || reply.trim().length === 0}
              onClick={() =>
                start(async () => {
                  const r = await respondToInquiry(row.id, reply.trim());
                  if (r.error) setMsg(null);
                  else {
                    setStatus('responded');
                    setMsg('Reply sent and the inquiry marked as responded.');
                  }
                })
              }
            >
              Send reply
            </button>
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as InquiryStatus;
                setStatus(next);
                start(async () => {
                  await setInquiryStatus(row.id, next);
                });
              }}
              style={{ maxWidth: '10rem' }}
            >
              {(['submitted', 'assigned', 'responded', 'closed'] as InquiryStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
