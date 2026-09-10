'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, type Department, type Service } from '@/lib/types';

type Position = {
  id: string;
  number: string;
  department: Department;
  state: 'waiting' | 'serving';
  ahead: number;
  window: string | null;
} | null;

const STORE = 'guest-ticket';

/**
 * A number for somebody who has not signed in.
 *
 * They stand in exactly the same line as everyone else -- the counter cannot
 * tell the difference and neither can the lobby screen. The ticket id is kept
 * in this browser and is the only proof of ownership, which is why the page
 * says so plainly: clear the browser and the number is gone, though the place
 * in the line is not.
 */
export default function GuestTicket({
  services,
  initialDept,
}: {
  services: Service[];
  initialDept: Department;
}) {
  const [dept, setDept] = useState<Department>(initialDept);
  const [serviceId, setServiceId] = useState<string>('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [pos, setPos] = useState<Position>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = services.filter((s) => s.department === dept && s.active);

  const look = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase.rpc('guest_queue_position', { p_ticket: id });
    const next = (data as Position) ?? null;
    setPos(next);
    // Yesterday's ticket, or one the counter has finished with: stop holding it.
    if (!next) {
      try { localStorage.removeItem(STORE); } catch { /* blocked storage */ }
      setTicketId(null);
    }
    return next;
  }, []);

  // What this browser was holding when the page loaded.
  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem(STORE); } catch { /* private mode */ }
    if (!id) {
      setChecked(true);
      return;
    }
    setTicketId(id);
    look(id).finally(() => setChecked(true));
  }, [look]);

  // Follow the same broadcast the television listens to, so the position moves
  // when staff call somebody rather than only on reload.
  useEffect(() => {
    if (!ticketId || !pos) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${pos.department}`)
      .on('broadcast', { event: 'called' }, () => look(ticketId))
      .subscribe();
    const poll = setInterval(() => look(ticketId), 15_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [ticketId, pos, look]);

  async function take() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('take_guest_number', {
      dept,
      p_service: serviceId ? Number(serviceId) : null,
    });

    if (rpcError || !data) {
      setError(
        rpcError?.message.includes('take_guest_number')
          ? 'Guest numbers are not set up on this site yet. Ask a staff member at the window.'
          : rpcError?.message ?? 'That did not work. Ask a staff member at the window.',
      );
      setBusy(false);
      return;
    }

    const issued = data as { id: string };
    try { localStorage.setItem(STORE, issued.id); } catch { /* blocked storage */ }
    setTicketId(issued.id);
    await look(issued.id);
    setBusy(false);
  }

  function forget() {
    try { localStorage.removeItem(STORE); } catch { /* blocked storage */ }
    setTicketId(null);
    setPos(null);
  }

  if (!checked) return <p className="muted">Checking&hellip;</p>;

  if (pos) {
    return (
      <div className="stack">
        <div className="card stack" style={{ alignItems: 'flex-start' }}>
          <span className="label">Your number</span>
          <p className="ticket-number">{pos.number}</p>

          {pos.state === 'serving' ? (
            <p className="notice good" style={{ width: '100%' }}>
              You are being served now &mdash; proceed to {pos.window ?? 'the window'}.
            </p>
          ) : (
            <p className="lede">
              {pos.ahead === 0
                ? 'You are next. Stay near the counter.'
                : `${pos.ahead} ${pos.ahead === 1 ? 'person is' : 'people are'} ahead of you.`}
            </p>
          )}

          <div className="row">
            <Link className="btn ghost" href={`/display/${pos.department}`}>
              Open the lobby screen
            </Link>
            <button className="ghost" onClick={forget}>I am done with this number</button>
          </div>
        </div>

        <p className="muted small">
          This number lives in this browser. Close the tab and it is still here; clear
          your history and you will need to ask at the window instead.{' '}
          <Link className="textlink" href="/login">Make an account</Link> and it follows
          you between devices.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Take a number without an account</h2>
        <p className="muted">
          You will be called in the same order as everybody else. No account, no email,
          nothing to fill in beyond what you are here for.
        </p>

        <div className="bookbar-row">
          <span className="label">Office</span>
          <div className="segmented">
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`seg${dept === d.id ? ' on' : ''}`}
                onClick={() => {
                  setDept(d.id);
                  setServiceId('');
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="label">What do you need? (optional)</span>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            style={{ maxWidth: '22rem' }}
          >
            <option value="">Not sure yet</option>
            {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        {error && <p className="notice bad">{error}</p>}

        <div className="row">
          <button onClick={take} disabled={busy}>
            {busy ? 'Getting your number…' : 'Get a queue number'}
          </button>
        </div>
      </div>

      <div className="aside-card">
        <h3>What an account adds</h3>
        <p className="muted small">
          A guest number gets you seen. Filing a request, attaching a document, booking a
          set time, and being told when your paperwork is ready all need an account,
          because there has to be somewhere to send the answer.
        </p>
        <div className="row">
          <Link className="btn ghost tiny" href="/login">Sign in or register</Link>
        </div>
      </div>
    </div>
  );
}
