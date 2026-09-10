'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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

/** One time of day, with every window that offers it. */
type Offer = {
  starts_at: string;
  hour: number;
  free: { window_id: number; window_label: string }[];
  total: number;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const isoDay = (d: Date) => {
  // Local date, not UTC: toISOString() here is still yesterday until mid-morning.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const dayLabel = (iso: string, todayIso: string) => {
  if (iso === todayIso) return 'Today';
  const tomorrow = new Date(`${todayIso}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === isoDay(tomorrow)) return 'Tomorrow';
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'short' });
};

/**
 * Picking a time to come in.
 *
 * Listed by time of day rather than by window. Which counter you end up at is
 * the office's business, not the student's, and a window each meant reading
 * the same eighteen times twice over and choosing between them for no reason.
 * Booking takes the first free window at the time you picked.
 */
export default function SlotPicker({ initialDept }: { initialDept: Department }) {
  const [dept, setDept] = useState<Department>(initialDept);
  const today = useMemo(() => isoDay(new Date()), []);
  const [day, setDay] = useState(today);
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

  const goto = (next: string) => {
    setSlots(null);
    setMsg(null);
    setDay(next);
  };

  // The week ahead as chips, so the common case never opens a date picker.
  const week = useMemo(() => {
    const base = new Date(`${today}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return isoDay(d);
    });
  }, [today]);

  // Collapse the windows into one entry per time.
  const offers: Offer[] = useMemo(() => {
    const byTime = new Map<string, Offer>();
    for (const s of slots ?? []) {
      const o = byTime.get(s.starts_at) ?? {
        starts_at: s.starts_at,
        hour: new Date(s.starts_at).getHours(),
        free: [],
        total: 0,
      };
      o.total += 1;
      if (!s.taken) o.free.push({ window_id: s.window_id, window_label: s.window_label });
      byTime.set(s.starts_at, o);
    }
    return [...byTime.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [slots]);

  const morning = offers.filter((o) => o.hour < 12);
  const afternoon = offers.filter((o) => o.hour >= 12);
  const freeCount = offers.filter((o) => o.free.length > 0).length;

  const book = (o: Offer) => {
    const w = o.free[0];
    if (!w) return;
    start(async () => {
      const r = await bookSlot(w.window_id, o.starts_at);
      setMsg(
        r.error
          ? { kind: 'bad', text: r.error }
          : { kind: 'ok', text: `Booked ${time(o.starts_at)} at ${w.window_label}.` },
      );
      reload();
    });
  };

  return (
    <div className="stack">
      <div className="bookbar">
        <div className="bookbar-row">
          <span className="label">Office</span>
          <div className="segmented">
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`seg${dept === d.id ? ' on' : ''}`}
                onClick={() => {
                  setSlots(null);
                  setMsg(null);
                  setDept(d.id);
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bookbar-row">
          <span className="label">Day</span>
          <div className="daystrip">
            {week.map((d) => (
              <button
                key={d}
                type="button"
                className={`daychip${day === d ? ' on' : ''}`}
                onClick={() => goto(d)}
              >
                <span className="daychip-name">{dayLabel(d, today)}</span>
                <span className="daychip-date">
                  {new Date(`${d}T12:00:00`).toLocaleDateString([], {
                    day: 'numeric', month: 'short',
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bookbar-row">
          <span className="label">Or a later date</span>
          <input
            type="date"
            value={day}
            min={today}
            onChange={(e) => e.target.value && goto(e.target.value)}
            style={{ maxWidth: '12rem' }}
          />
        </div>
      </div>

      {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}

      {loading && <p className="muted">Looking for open times&hellip;</p>}

      {!loading && offers.length === 0 && (
        <p className="notice">
          No windows are open at that office on this day. Try another date.
        </p>
      )}

      {!loading && offers.length > 0 && (
        <>
          <p className="muted small" style={{ margin: 0 }}>
            {freeCount === 0
              ? 'Every time on this day is taken. Try another date, or take a walk-in number.'
              : `${freeCount} of ${offers.length} times still free. A greyed-out time has been taken by somebody else.`}
          </p>

          <SlotGroup title="Morning" offers={morning} onBook={book} pending={pending} />
          <SlotGroup title="Afternoon" offers={afternoon} onBook={book} pending={pending} />
        </>
      )}
    </div>
  );
}

function SlotGroup({
  title,
  offers,
  onBook,
  pending,
}: {
  title: string;
  offers: Offer[];
  onBook: (o: Offer) => void;
  pending: boolean;
}) {
  if (offers.length === 0) return null;

  return (
    <section className="stack" style={{ gap: '.5rem' }}>
      <span className="label">{title}</span>
      <div className="slotgrid">
        {offers.map((o) => {
          const free = o.free.length;
          return (
            <button
              key={o.starts_at}
              type="button"
              className={`slot${free === 0 ? ' taken' : ''}`}
              disabled={free === 0 || pending}
              title={
                free === 0
                  ? 'Already booked'
                  : `Book ${time(o.starts_at)} — ${free} of ${o.total} windows free`
              }
              onClick={() => onBook(o)}
            >
              <span className="slot-time">{time(o.starts_at)}</span>
              <span className="slot-free">
                {free === 0 ? 'taken' : o.total > 1 ? `${free} free` : 'free'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
