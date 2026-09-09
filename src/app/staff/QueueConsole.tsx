'use client';

import { useState, useTransition } from 'react';
import {
  callNext,
  setTicketState,
  issueWalkInTicket,
  postAnnouncement,
} from './actions';
import type { Department, QueueTicket, Service, ServiceWindow } from '@/lib/types';

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
      <div className="card stack">
        <div className="row">
          <label className="field" style={{ minWidth: '12rem' }}>
            <span className="label">Your window</span>
            <select
              value={windowId ?? ''}
              onChange={(e) => setWindowId(Number(e.target.value))}
            >
              {windows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
          <button
            disabled={pending || !windowId}
            onClick={() => windowId && run(() => callNext(dept, windowId))}
            style={{ alignSelf: 'end' }}
          >
            {pending ? 'Working…' : 'Call next'}
          </button>
        </div>
        {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}
        <p className="muted" style={{ fontSize: '.86rem' }}>
          Calling completes whoever was at your window, promotes the oldest waiting ticket,
          and announces it on the lobby screen.
        </p>
      </div>

      <div className="card stack">
        <span className="label">Walk-in without an account</span>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: '14rem' }}>
            <span className="label">Service</span>
            <select value={walkInService} onChange={(e) => setWalkInService(e.target.value)}>
              <option value="">Unspecified</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
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
          placeholder="e.g. Treasury closes at 3:00 PM today."
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

      <div className="card stack">
        <span className="label">At the windows now &middot; {serving.length}</span>
        {serving.length === 0 && <p className="muted">Nobody is being served.</p>}
        {serving.map((t) => (
          <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong className="mono" style={{ fontSize: '1.05rem' }}>{t.number}</strong>
              <span className="muted"> &middot; {label(t.window_id)}</span>
            </span>
            <span className="row" style={{ gap: '.4rem' }}>
              <button className="ghost" disabled={pending}
                onClick={() => run(() => setTicketState(t.id, 'completed', dept))}>
                Completed
              </button>
              <button className="warn" disabled={pending}
                onClick={() => run(() => setTicketState(t.id, 'skipped', dept))}>
                Skip
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card stack">
          <span className="label">Waiting &middot; {waiting.length}</span>
          {waiting.length === 0
            ? <p className="muted">Queue is empty.</p>
            : waiting.map((t) => <span key={t.id} className="mono">{t.number}</span>)}
        </div>
        <div className="card stack">
          <span className="label">Skipped &middot; {skipped.length}</span>
          {skipped.length === 0
            ? <p className="muted">Nobody skipped.</p>
            : skipped.map((t) => (
                <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="mono">{t.number}</span>
                  <button className="ghost" disabled={pending}
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
