'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  setRequestStatus,
  respondToInquiry,
  setAppointmentStatus,
} from './actions';
import { REQUEST_PIPELINE, STATUS_LABEL, type RequestStatus } from '@/lib/types';

export type MyRequest = {
  id: string;
  reference: string;
  service: string;
  status: RequestStatus;
  details: string;
};

export type MyInquiry = {
  id: string;
  reference: string;
  subject: string;
  body: string;
  name: string;
};

export type WindowAppointment = {
  id: string;
  window_id: number;
  starts_at: string;
  status: string;
  student: string;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * The counter-side view of your own work.
 *
 * Requests and Inquiries list everything the office holds, which is right for
 * planning and wrong for a window: at a window you are dealing with the one
 * person in front of you, and the things you took on are the things you need
 * within reach. So these three panels are yours alone -- what you catered in
 * the inbox, and the appointments booked at the window you are sitting at --
 * each with the smallest form that finishes the job, so nobody has to leave
 * the queue screen with somebody standing there.
 */
export default function MyWork({
  requests,
  inquiries,
  appointments,
  windowId,
  windowLabel,
  deptQuery,
}: {
  requests: MyRequest[];
  inquiries: MyInquiry[];
  appointments: WindowAppointment[];
  windowId: number | undefined;
  windowLabel: string;
  deptQuery: string;
}) {
  const mine = appointments.filter((a) => a.window_id === windowId);

  return (
    <div className="charts">
      <RequestPanel rows={requests} deptQuery={deptQuery} />
      <InquiryPanel rows={inquiries} deptQuery={deptQuery} />
      <AppointmentPanel rows={mine} windowLabel={windowLabel} deptQuery={deptQuery} />
    </div>
  );
}

function PanelHead({
  title,
  count,
  href,
  linkText,
}: {
  title: string;
  count: number;
  href: string;
  linkText: string;
}) {
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: '.5rem' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <span className="pill on">{count}</span>
      <span className="spacer" />
      <Link className="textlink" href={href}>{linkText}</Link>
    </div>
  );
}

function RequestPanel({ rows, deptQuery }: { rows: MyRequest[]; deptQuery: string }) {
  return (
    <div className="card chart-card">
      <PanelHead
        title="Your requests" count={rows.length}
        href={`/staff/requests${deptQuery}`} linkText="All requests"
      />
      {rows.length === 0 ? (
        <p className="muted small">
          Nothing on you. Take a request in the Inbox and it appears here.
        </p>
      ) : (
        <ul className="minilist">
          {rows.map((r) => <RequestItem key={r.id} row={r} />)}
        </ul>
      )}
    </div>
  );
}

function RequestItem({ row }: { row: MyRequest }) {
  const [status, setStatus] = useState<RequestStatus>(row.status);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="mini">
      <div className="mini-head">
        <span className="mono ticket-ref">{row.reference}</span>
        <span className="spacer" />
        <span className="pill">{STATUS_LABEL[status]}</span>
      </div>
      <strong className="mini-title">{row.service}</strong>
      <p className="mini-detail muted">{row.details}</p>

      <div className="mini-form">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus)}
          aria-label={`Status for ${row.reference}`}
        >
          {REQUEST_PIPELINE.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
          <option value="cancelled">{STATUS_LABEL.cancelled}</option>
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the student (optional)"
          aria-label={`Note for ${row.reference}`}
        />
        <button
          className="tiny"
          disabled={pending || status === row.status}
          onClick={() =>
            start(async () => {
              const r = await setRequestStatus(row.id, status, note.trim() || null);
              setMsg(r.error ?? 'Saved. They have been notified.');
              if (!r.error) setNote('');
            })
          }
        >
          {pending ? 'Saving…' : 'Update'}
        </button>
      </div>
      {msg && <p className="mini-msg muted">{msg}</p>}
    </li>
  );
}

function InquiryPanel({ rows, deptQuery }: { rows: MyInquiry[]; deptQuery: string }) {
  return (
    <div className="card chart-card">
      <PanelHead
        title="Your inquiries" count={rows.length}
        href={`/staff/inquiries${deptQuery}`} linkText="All inquiries"
      />
      {rows.length === 0 ? (
        <p className="muted small">
          Nothing on you. Take an inquiry in the Inbox and it appears here.
        </p>
      ) : (
        <ul className="minilist">
          {rows.map((r) => <InquiryItem key={r.id} row={r} />)}
        </ul>
      )}
    </div>
  );
}

function InquiryItem({ row }: { row: MyInquiry }) {
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="mini">
      <div className="mini-head">
        <span className="mono ticket-ref">{row.reference}</span>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: '.85rem' }}>{row.name}</span>
      </div>
      <strong className="mini-title">{row.subject}</strong>
      <p className="mini-detail muted">{row.body}</p>

      <div className="mini-form">
        <textarea
          rows={2}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type the answer — it is emailed to them"
          aria-label={`Reply to ${row.reference}`}
        />
        <button
          className="tiny"
          disabled={pending || reply.trim().length < 2}
          onClick={() =>
            start(async () => {
              const r = await respondToInquiry(row.id, reply.trim());
              setMsg(r.error ?? 'Sent.');
              if (!r.error) setReply('');
            })
          }
        >
          {pending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
      {msg && <p className="mini-msg muted">{msg}</p>}
    </li>
  );
}

function AppointmentPanel({
  rows,
  windowLabel,
  deptQuery,
}: {
  rows: WindowAppointment[];
  windowLabel: string;
  deptQuery: string;
}) {
  return (
    <div className="card chart-card">
      <PanelHead
        title={`Booked at ${windowLabel}`} count={rows.length}
        href={`/staff/appointments${deptQuery}`} linkText="All appointments"
      />
      {rows.length === 0 ? (
        <p className="muted small">
          Nothing booked at this window today. Switch windows above and this list
          follows you.
        </p>
      ) : (
        <ul className="minilist">
          {rows.map((a) => <AppointmentItem key={a.id} row={a} />)}
        </ul>
      )}
    </div>
  );
}

function AppointmentItem({ row }: { row: WindowAppointment }) {
  const [status, setStatus] = useState(row.status);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (next: 'attended' | 'cancelled') =>
    start(async () => {
      const r = await setAppointmentStatus(row.id, next);
      if (r.error) setMsg(r.error);
      else {
        setStatus(next);
        setMsg(null);
      }
    });

  return (
    <li className="mini">
      <div className="mini-head">
        <strong className="mono" style={{ fontSize: '1.05rem' }}>{time(row.starts_at)}</strong>
        <span className="spacer" />
        <span className={`pill${status === 'attended' ? ' good' : status === 'cancelled' ? ' warn' : ''}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <strong className="mini-title">{row.student}</strong>

      {status === 'booked' && (
        <div className="mini-form">
          <button className="tiny" disabled={pending} onClick={() => set('attended')}>
            {pending ? 'Saving…' : 'They came'}
          </button>
          <button className="ghost tiny" disabled={pending} onClick={() => set('cancelled')}>
            No-show
          </button>
        </div>
      )}
      {msg && <p className="mini-msg muted">{msg}</p>}
    </li>
  );
}
