'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bookSlot } from './actions';
import { DEPARTMENTS, type Department } from '@/lib/types';

type Slot = {
  window_id: number;
  window_label: string;
  starts_at: string;
  ends_at: string;
  taken: boolean;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function SlotPicker({ initialDept }: { initialDept: Department }) {
  const [dept, setDept] = useState<Department>(initialDept);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  // null means "not fetched yet", so the loading state is derived rather than
  // a second piece of state to keep in step.
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const loading = slots === null;

  useEffect(() => {
    // Cancellation matters here: change the date twice quickly and the first
    // response can land after the second, showing yesterday's slots.
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('available_slots', { dept, p_day: day });
      if (!cancelled) setSlots((data ?? []) as Slot[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [dept, day, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const byWindow = (slots ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.window_label] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: '11rem' }}>
          <span className="label">Department</span>
          <select
            value={dept}
            onChange={(e) => {
              setSlots(null);
              setDept(e.target.value as Department);
            }}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: '11rem' }}>
          <span className="label">Date</span>
          <input
            type="date"
            value={day}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setSlots(null);
              setDay(e.target.value);
            }}
          />
        </label>
      </div>

      {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}

      {loading && <p className="muted">Loading slots&hellip;</p>}

      {slots !== null && slots.length === 0 && (
        <p className="notice">No windows are open for this department on that day.</p>
      )}

      {!loading &&
        Object.entries(byWindow).map(([label, list]) => (
          <div key={label} className="card stack">
            <span className="label">{label}</span>
            <div className="row" style={{ gap: '.4rem' }}>
              {list.map((s) => (
                <button
                  key={s.starts_at}
                  className="ghost"
                  disabled={s.taken || pending}
                  title={s.taken ? 'Already booked' : `Book ${label} at ${time(s.starts_at)}`}
                  style={
                    s.taken
                      ? { textDecoration: 'line-through', color: 'var(--faint)' }
                      : undefined
                  }
                  onClick={() =>
                    start(async () => {
                      const r = await bookSlot(s.window_id, s.starts_at);
                      if (r.error) setMsg({ kind: 'bad', text: r.error });
                      else setMsg({ kind: 'ok', text: `Booked ${label} at ${time(s.starts_at)}.` });
                      reload();
                    })
                  }
                >
                  {time(s.starts_at)}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
