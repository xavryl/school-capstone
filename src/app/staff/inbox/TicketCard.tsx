'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { claim, assign } from './actions';

export type Ticket = {
  kind: 'request' | 'inquiry';
  id: string;
  reference: string;
  title: string;
  detail: string;
  status: string;
  department: string;
  assigned_to: string | null;
  created_at: string;
};

export type Colleague = { id: string; name: string };

const age = (iso: string) => {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export default function TicketCard({
  ticket,
  mine,
  canManage,
  colleagues,
  showDepartment,
}: {
  ticket: Ticket;
  mine: boolean;
  canManage: boolean;
  colleagues: Colleague[];
  showDepartment: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const href = ticket.kind === 'request' ? '/staff/requests' : '/staff/inquiries';

  return (
    <div className="ticket">
      <div className="ticket-head">
        <span className={`pill ${ticket.kind === 'request' ? 'on' : 'warn'}`}>
          {ticket.kind === 'request' ? 'Request' : 'Inquiry'}
        </span>
        <span className="mono ticket-ref">{ticket.reference}</span>
        {showDepartment && (
          <span className="pill" style={{ textTransform: 'capitalize' }}>
            {ticket.department}
          </span>
        )}
        <span className="spacer" />
        <span className="muted" style={{ fontSize: '.9rem' }}>{age(ticket.created_at)}</span>
      </div>

      <strong className="ticket-title">{ticket.title}</strong>
      <p className="muted ticket-detail">
        {ticket.detail.slice(0, 180)}{ticket.detail.length > 180 ? '…' : ''}
      </p>

      {msg && <p className="notice bad">{msg}</p>}

      <div className="row">
        {!mine && (
          <button
            className="tiny"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await claim(ticket.kind, ticket.id);
                setMsg(r.error ?? null);
              })
            }
          >
            {pending ? 'Taking…' : 'Take this one'}
          </button>
        )}

        <Link className="btn ghost tiny" href={href}>Open in {ticket.kind === 'request' ? 'Requests' : 'Inquiries'}</Link>

        {mine && (
          <button
            className="ghost tiny"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await assign(ticket.kind, ticket.id, null);
                setMsg(r.error ?? null);
              })
            }
          >
            Put back
          </button>
        )}

        {canManage && colleagues.length > 0 && (
          <select
            defaultValue=""
            disabled={pending}
            style={{ maxWidth: '12rem' }}
            onChange={(e) => {
              const to = e.target.value;
              if (!to) return;
              start(async () => {
                const r = await assign(ticket.kind, ticket.id, to);
                setMsg(r.error ?? null);
              });
            }}
          >
            <option value="">Hand to…</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
