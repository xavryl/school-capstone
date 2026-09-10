'use client';

import { useState, useTransition } from 'react';
import {
  callNext,
  setTicketState,
  issueWalkInTicket,
  postAnnouncement,
} from './actions';
import type { Department, QueueTicket, Service, ServiceWindow } from '@/lib/types';

const waited = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just arrived';
  if (mins < 60) return `waiting ${mins} min`;
  const h = Math.floor(mins / 60);
  return `waiting ${h}h ${mins % 60}m`;
};

export default function QueueConsole({
  dept,
  windows,
  tickets,
  services,
  announcement,
}: {
  dept: Department;
  windows: ServiceWindow[];
  tickets: QueueTicket[];
  services: Service[];
  announcement: string;
}) {
  const [windowId, setWindowId] = useState<number | undefined>(windows[0]?.id);
  const [walkInService, setWalkInService] = useState<string>('');
  const [banner, setBanner] = useState(announcement);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const serving = tickets.filter((t) => t.state === 'serving');
  const waiting = tickets.filter((t) => t.state === 'waiting');
  const skipped = tickets.filter((t) => t.state === 'skipped');
  const label = (id: number | null) => windows.find((w) => w.id === id)?.label ?? '—';
  const serviceName = (id: number | null) =>
    services.find((s) => s.id === id)?.name ?? 'Unspecified service';

  // The two tickets the button is actually about: whoever you are with now,
  // and whoever it will fetch. Naming them is the difference between "Call
  // next" and knowing what you are about to do.
  const mine = serving.find((t) => t.window_id === windowId) ?? null;
  const next = waiting[0] ?? null;
  const myWindow = windows.find((w) => w.id === windowId);

  function run(fn: () => Promise<{ error?: string; ok?: unknown }>, okText = 'Done.') {
    start(async () => {
      const r = await fn();
      setMsg(
        r.error
          ? { kind: 'bad', text: r.error }
          : { kind: 'ok', text: typeof r.ok === 'string' ? `Issued ${r.ok}.` : okText },
      );
    });
  }

  return (
    <div className="stack">
      <div className="card stack callcard">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: '10rem' }}>
            <span className="label">Your window</span>
            <select
              value={windowId ?? ''}
              onChange={(e) => setWindowId(Number(e.target.value))}
            >
              {windows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
        </div>

        <div className="callgrid">
          <div className="callnow">
            <span className="label">At your window now</span>
            {mine ? (
              <>
                <strong className="bignum">{mine.number}</strong>
                <span className="muted">{serviceName(mine.service_id)}</span>
              </>
            ) : (
              <span className="muted">Nobody yet.</span>
            )}
          </div>

          <div className="callnext">
            <span className="label">Next in line</span>
            {next ? (
              <>
                <strong className="bignum">{next.number}</strong>
                <span className="muted">
                  {serviceName(next.service_id)} &middot; {waited(next.created_at)}
                </span>
              </>
            ) : (
              <span className="muted">Nobody is waiting.</span>
            )}
          </div>
        </div>

        <button
          className="callbtn"
          disabled={pending || !windowId || !next}
          onClick={() => windowId && run(() => callNext(dept, windowId))}
        >
          {pending
            ? 'Calling…'
            : next
              ? `Call ${next.number} to ${myWindow?.label ?? 'your window'}`
              : 'Nobody to call'}
        </button>

        {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}

        <p className="muted" style={{ fontSize: '.86rem' }}>
          {mine
            ? `Calling marks ${mine.number} completed, brings ${next ? next.number : 'the next ticket'} to ${myWindow?.label ?? 'your window'}, and announces it on the lobby screen.`
            : 'Calling brings the longest-waiting ticket to your window and announces it on the lobby screen.'}
        </p>
      </div>

      <div className="grid2">
        <div className="card stack">
          <span className="label">Walk-in without an account</span>
          <label className="field">
            <span className="label">Service</span>
            <select value={walkInService} onChange={(e) => setWalkInService(e.target.value)}>
              <option value="">Unspecified</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="row">
            <button
              className="ghost"
              disabled={pending}
              onClick={() =>
                run(() => issueWalkInTicket(dept, walkInService ? Number(walkInService) : null))
              }
            >
              Issue a number
            </button>
          </div>
        </div>

        <div className="card stack">
          <span className="label">Lobby screen announcement</span>
          <input
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            placeholder="e.g. This office closes at 3:00 PM today."
          />
          <div className="row">
            <button
              className="ghost"
              disabled={pending}
              onClick={() => run(() => postAnnouncement(dept, banner), 'Announcement updated.')}
            >
              Post to screen
            </button>
            <button
              className="ghost"
              disabled={pending || banner === ''}
              onClick={() => {
                setBanner('');
                run(() => postAnnouncement(dept, ''), 'Announcement cleared.');
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card stack">
          <span className="label">At the windows now &middot; {serving.length}</span>
          {serving.length === 0 && <p className="muted">Nobody is being served.</p>}
          {serving.map((t) => (
            <div key={t.id} className="stack" style={{ gap: '.35rem' }}>
              <span>
                <strong className="mono" style={{ fontSize: '1.05rem' }}>{t.number}</strong>
                <span className="muted"> &middot; {label(t.window_id)}</span>
              </span>
              <span className="muted" style={{ fontSize: '.87rem' }}>
                {serviceName(t.service_id)}
              </span>
              <span className="row" style={{ gap: '.4rem' }}>
                <button className="ghost tiny" disabled={pending}
                  onClick={() => run(() => setTicketState(t.id, 'completed', dept))}>
                  Completed
                </button>
                <button className="warn tiny" disabled={pending}
                  onClick={() => run(() => setTicketState(t.id, 'skipped', dept))}>
                  Skip
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="card stack">
          <span className="label">Waiting &middot; {waiting.length}</span>
          {waiting.length === 0
            ? <p className="muted">Queue is empty.</p>
            : waiting.map((t) => (
                <span key={t.id}>
                  <strong className="mono">{t.number}</strong>
                  <span className="muted" style={{ fontSize: '.87rem' }}>
                    {' '}&middot; {serviceName(t.service_id)}
                  </span>
                </span>
              ))}
        </div>

        <div className="card stack">
          <span className="label">Skipped &middot; {skipped.length}</span>
          {skipped.length === 0
            ? <p className="muted">Nobody skipped.</p>
            : skipped.map((t) => (
                <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="mono">{t.number}</span>
                  <button className="ghost tiny" disabled={pending}
                    onClick={() => run(() => setTicketState(t.id, 'waiting', dept))}>
                    Recall
                  </button>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
