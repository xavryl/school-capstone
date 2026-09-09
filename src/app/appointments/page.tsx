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

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Sign in to book</h1>
        <p className="lede">
          Appointments are tied to your account so the office knows who to expect.
        </p>
        <div className="row">
          <Link className="btn" href="/login">Sign in</Link>
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

  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow">Appointments</span>
        <h1>Book a window</h1>
        <p className="lede narrow">
          Half-hour slots, 8:00 to 5:00, lunch hour closed. A slot that greys out while
          you are looking has just been taken by someone else.
        </p>
      </header>

      <section className="stack">
        <h2>Your upcoming appointments</h2>
        <MyAppointments rows={rows} />
      </section>

      <section className="stack">
        <h2>Open slots</h2>
        <SlotPicker initialDept={initialDept} />
      </section>
    </main>
  );
}
