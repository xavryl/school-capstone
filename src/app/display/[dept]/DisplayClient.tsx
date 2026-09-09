'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Department, QueueSnapshot } from '@/lib/types';

const POLL_MS = 10_000;
const STALE_MS = 30_000;
const CACHE_KEY = 'queue-snapshot';

export default function DisplayClient({
  dept, initial,
}: { dept: Department; initial: QueueSnapshot | null }) {
  const [snap, setSnap] = useState<QueueSnapshot | null>(initial);
  const [lastOk, setLastOk] = useState<number>(Date.now());
  const [clock, setClock] = useState('');
  const spoken = useRef<Set<string>>(new Set());

  // Read the cached snapshot if the server render came back empty -- an
  // outage then freezes the screen on a real number instead of showing an
  // error page to a lobby full of people.
  useEffect(() => {
    if (snap) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setSnap(JSON.parse(raw) as QueueSnapshot);
    } catch { /* private mode, blocked storage */ }
  }, [snap]);

  useEffect(() => {
    if (!snap) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch {}
  }, [snap]);

  function announce(number: string, window: string) {
    if (spoken.current.has(number)) return;
    spoken.current.add(number);
    try {
      // Built into the browser: no audio files, no library, no recording.
      speechSynthesis.speak(
        new SpeechSynthesisUtterance(`Now serving ${number.split('').join(' ')}, ${window}`),
      );
    } catch { /* speech unavailable on this device */ }
  }

  useEffect(() => {
    const supabase = createClient();

    async function refresh(announceNew: boolean) {
      const { data, error } = await supabase.rpc('current_queue_state', { dept });
      if (error || !data) return;
      const next = data as QueueSnapshot;
      setSnap(next);
      setLastOk(Date.now());
      if (announceNew) next.serving.forEach((s) => announce(s.number, s.window));
    }

    // Primary path: a broadcast from the staff console.
    const channel = supabase
      .channel(`queue:${dept}`)
      .on('broadcast', { event: 'called' }, ({ payload }) => {
        const p = payload as { number?: string; window?: string };
        if (p.number && p.window) announce(p.number, p.window);
        refresh(false);
      })
      .subscribe();

    // Backstop. A dead socket looks exactly like a quiet morning, so the
    // screen must repair itself without anyone noticing it broke.
    const poll = setInterval(() => refresh(true), POLL_MS);
    refresh(false);

    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [dept]);

  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const age = Date.now() - lastOk;
  const health = age < STALE_MS ? '' : age < STALE_MS * 4 ? 'stale' : 'dead';
  const serving = snap?.serving ?? [];
  const waiting = snap?.waiting ?? [];

  return (
    <div className="tv">
      <div className="tv-head">
        <span className="tv-dept" style={{ textTransform: 'capitalize' }}>{dept}</span>
        <span className="eyebrow">Now serving</span>
        <span className="tv-clock">{clock}</span>
      </div>

      <div className="tv-body">
        <div className="tv-serving">
          {serving.length === 0 && (
            <div className="tv-slot">
              <span className="tv-num" style={{ color: 'var(--faint)' }}>&mdash;</span>
              <div className="tv-win">
                <div className="tv-win-label" style={{ color: 'var(--faint)' }}>No one is being served</div>
              </div>
            </div>
          )}
          {serving.map((s) => (
            <div key={s.window} className="tv-slot live">
              <span className="tv-num">{s.number}</span>
              <div className="tv-win">
                <div className="label">Proceed to</div>
                <div className="tv-win-label">{s.window}</div>
              </div>
            </div>
          ))}
        </div>

        <aside className="tv-next">
          <span className="label">Next in line</span>
          <ol>
            {waiting.length === 0
              ? <li style={{ color: 'var(--faint)' }}>Queue is empty</li>
              : waiting.map((n) => <li key={n}>{n}</li>)}
          </ol>
        </aside>
      </div>

      {snap?.announcement && (
        <div className="tv-banner">
          <span className="eyebrow">Notice</span>
          <span>{snap.announcement}</span>
        </div>
      )}

      <div className="tv-foot">
        <span className={`dot ${health}`} />
        <span>
          {health === '' ? 'Live' : health === 'stale' ? 'Reconnecting' : 'Offline \u2014 showing last known numbers'}
        </span>
        <span className="spacer" />
        <span>Please listen for your number and proceed to the window shown.</span>
      </div>
    </div>
  );
}
