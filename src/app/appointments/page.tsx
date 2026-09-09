import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';
import SlotPicker from './SlotPicker';
import MyAppointments from './MyAppointments';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
  service_windows: { label: string; department: string }[] | { label: string; department: string } | null;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  if (!user) {
    return (
      <main className="wrap stack-lg">
        <header className="stack">
          <span className="eyebrow">Appointments</span>
          <h1>Book a window</h1>
        </header>
        <div className="page-grid">
          <div className="card stack">
            <h2>Sign in to book</h2>
            <p className="muted">
              Appointments are tied to your account so the office knows who to expect,
              and so you can cancel if your plans change.
            </p>
            <div className="row">
              <Link className="btn" href="/login">Sign in</Link>
              <Link className="btn ghost" href="/queue">Take a queue number instead</Link>
            </div>
          </div>
          <Guidance />
        </div>
      </main>
    );
  }

  const { data: mine } = await supabase
    .from('appointments')
    .select('id, starts_at, status, service_windows(label, department)')
    .eq('student_id', user.id)
    .neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');

  const rows = ((mine ?? []) as AppointmentRow[]).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    status: a.status,
    service_windows: Array.isArray(a.service_windows) ? a.service_windows[0] : a.service_windows,
  }));

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow">Appointments</span>
        <h1>Book a window</h1>
        <p className="lede" style={{ maxWidth: '38rem' }}>
          Reserve a half-hour slot and skip the walk-in line. A slot that greys out while
          you are looking has just been taken by someone else.
        </p>
      </header>

      <div className="page-grid">
        <div className="stack-lg">
          <section className="stack">
            <h2>Your upcoming appointments</h2>
            <MyAppointments rows={rows} />
          </section>

          <section className="stack">
            <h2>Open slots</h2>
            <SlotPicker initialDept={initialDept} />
          </section>
        </div>

        <Guidance />
      </div>
    </main>
  );
}

function Guidance() {
  return (
    <aside className="stack">
      <div className="aside-card">
        <h3>How booking works</h3>
        <ul className="ticklist">
          <li><Tick />Half-hour slots, 8:00 AM to 5:00 PM</li>
          <li><Tick />The lunch hour is closed</li>
          <li><Tick />One person per slot per window</li>
          <li><Tick />Book up to any future date</li>
        </ul>
      </div>

      <div className="aside-card">
        <h3>Bring with you</h3>
        <p className="muted small">
          A valid school or government ID. If you are collecting for someone else, bring
          their authorisation letter and a copy of their ID as well.
        </p>
      </div>

      <div className="aside-card">
        <h3>Plans changed?</h3>
        <p className="muted small">
          Cancel from this page any time and the slot goes straight back into the pool
          for someone else. There is no penalty for cancelling.
        </p>
      </div>

      <div className="aside-card">
        <h3>Nothing free today?</h3>
        <p className="muted small">
          Take a walk-in number instead. You will be seen in order rather than at a set
          time, but you can still step away and watch your position.
        </p>
        <Link className="btn ghost tiny" href="/queue">Take a number</Link>
      </div>
    </aside>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
