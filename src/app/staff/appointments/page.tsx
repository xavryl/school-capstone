import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, scopeLabel } from '@/lib/staff';
import AppointmentList, { type StaffAppointment } from '../AppointmentList';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string; day?: string }> };

type Row = {
  id: string;
  starts_at: string;
  status: string;
  service_windows: { label: string; department: string }[] | { label: string; department: string } | null;
};

const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function StaffAppointmentsPage({ searchParams }: Props) {
  const { dept, day } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const date = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today();

  const supabase = await createClient();
  // !inner so the department filter on the joined window actually narrows the
  // appointments, rather than returning them all with an empty join.
  const { data } = await supabase
    .from('appointments')
    .select('id, starts_at, status, service_windows!inner(label, department)')
    .in('service_windows.department', ctx.departments)
    .gte('starts_at', `${date}T00:00:00`)
    .lte('starts_at', `${date}T23:59:59`)
    .order('starts_at');

  const rows = ((data ?? []) as Row[]).map<StaffAppointment>((a) => {
    const w = one(a.service_windows);
    return {
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      window_label: ctx.departments.length > 1 && w
        ? `${w.label} · ${w.department}`
        : w?.label ?? 'Window',
    };
  });

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
        <h1>Appointments</h1>
        <form className="row" style={{ alignItems: 'flex-end' }}>
          {ctx.isAdmin && <input type="hidden" name="dept" value={ctx.scope} />}
          <label className="field" style={{ maxWidth: '12rem' }}>
            <span className="label">Day</span>
            <input type="date" name="day" defaultValue={date} />
          </label>
          <button style={{ alignSelf: 'end' }}>Show</button>
        </form>
      </header>

      <AppointmentList rows={rows} />
    </div>
  );
}
