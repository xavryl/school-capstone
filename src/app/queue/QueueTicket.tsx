'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, type Department, type Service } from '@/lib/types';

type Position = {
  number: string;
  state: 'waiting' | 'serving';
  ahead: number;
  window: string | null;
} | null;

export default function QueueTicket({
  services,
  initialDept,
}: {
  services: Service[];
  initialDept: Department;
}) {
  const [dept, setDept] = useState<Department>(initialDept);
  const [serviceId, setServiceId] = useState<string>('');
  const [pos, setPos] = useState<Position>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = services.filter((s) => s.department === dept && s.active);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc('my_queue_position', { dept });
    setPos((data as Position) ?? null);
    setLoading(false);
  }, [dept]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Follow the same broadcast the television listens to, so the student's
  // position updates when staff call someone rather than only on reload.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${dept}`)
      .on('broadcast', { event: 'called' }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 15_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [dept, refresh]);

  async function take() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('take_queue_number', {
      dept,
      p_service: serviceId ? Number(serviceId) : null,
      p_request: null,
    });
    if (rpcError) setError(rpcError.message);
    await refresh();
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: '11rem' }}>
          <span className="label">Department</span>
          <select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: '14rem' }}>
          <span className="label">What do you need?</span>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Not sure yet</option>
            {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="notice bad">{error}</p>}

      {loading && <p className="muted">Checking&hellip;</p>}

      {!loading && pos && (
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
            <Link className="btn ghost" href={`/display/${dept}`}>Open the lobby screen</Link>
          </div>
        </div>
      )}

      {!loading && !pos && (
        <div className="card stack" style={{ alignItems: 'flex-start' }}>
          <h2>You have no number today</h2>
          <p className="muted">
            Take one when you arrive on campus. You can leave the lobby once you have it
            &mdash; we will notify you, and the screen shows who is being served.
          </p>
          <button onClick={take} disabled={busy}>
            {busy ? 'Getting your number…' : 'Get a queue number'}
          </button>
        </div>
      )}
    </div>
  );
}
