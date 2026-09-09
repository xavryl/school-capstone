import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';
import VolumeChart, { type DailyRow } from './VolumeChart';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ from?: string; to?: string; dept?: string }> };

type Summary = {
  requests_total: number;
  requests_completed: number;
  requests_open: number;
  appointments: number;
  tickets: number;
  tickets_served: number;
  tickets_skipped: number;
  avg_wait_minutes: number | null;
  inquiries: number;
  inquiries_closed: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="tile-value">{value}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Staff sign-in required</h1>
        <div className="row"><Link className="btn" href="/login">Sign in</Link></div>
      </main>
    );
  }

  const { data: me } = await supabase
    .from('staff').select('department, is_admin').eq('user_id', user.id).maybeSingle();

  if (!me) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Not a staff account</h1>
        <p className="lede">Reports are limited to registrar and treasury personnel.</p>
      </main>
    );
  }

  // Both report functions accept any department for an admin, so the
  // proposal's separate "registrar transactions" and "treasury transactions"
  // reports are this one page with the selector below.
  const canSwitch = Boolean(me.is_admin);
  const requested = sp.dept === 'treasury' || sp.dept === 'registrar' ? sp.dept : null;
  const dept: Department = (canSwitch && requested ? requested : me.department) as Department;

  const to = sp.to ?? iso(new Date());
  const from = sp.from ?? iso(new Date(Date.now() - 13 * 86_400_000));

  const [{ data: summary }, { data: daily }] = await Promise.all([
    supabase.rpc('report_summary', { dept, p_from: from, p_to: to }),
    supabase.rpc('report_daily', { dept, p_from: from, p_to: to }),
  ]);

  const s = (summary ?? {}) as Partial<Summary>;
  const rows = ((daily ?? []) as DailyRow[]).map((r) => ({
    ...r,
    day: String(r.day).slice(0, 10),
  }));

  const csv = (type: string) =>
    `/staff/reports/export?type=${type}&from=${from}&to=${to}&dept=${dept}`;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow" style={{ textTransform: 'uppercase' }}>{dept} reports</span>
        <h1>Transactions and queue statistics</h1>
        <form className="row" style={{ alignItems: 'flex-end' }}>
          {canSwitch && (
            <label className="field" style={{ maxWidth: '11rem' }}>
              <span className="label">Department</span>
              <select name="dept" defaultValue={dept}>
                <option value="registrar">Registrar</option>
                <option value="treasury">Treasury</option>
              </select>
            </label>
          )}
          <label className="field" style={{ maxWidth: '11rem' }}>
            <span className="label">From</span>
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label className="field" style={{ maxWidth: '11rem' }}>
            <span className="label">To</span>
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button style={{ alignSelf: 'end' }}>Apply</button>
        </form>
      </header>

      <section className="tiles">
        <Tile label="Requests filed" value={String(s.requests_total ?? 0)} />
        <Tile label="Completed" value={String(s.requests_completed ?? 0)} />
        <Tile label="Still open" value={String(s.requests_open ?? 0)} />
        <Tile label="Appointments" value={String(s.appointments ?? 0)} />
        <Tile
          label="Queue tickets"
          value={String(s.tickets ?? 0)}
          hint={`${s.tickets_served ?? 0} served · ${s.tickets_skipped ?? 0} skipped`}
        />
        <Tile
          label="Average wait"
          value={s.avg_wait_minutes == null ? '—' : `${s.avg_wait_minutes} min`}
          hint="Ticket issued to called"
        />
        <Tile
          label="Inquiries"
          value={String(s.inquiries ?? 0)}
          hint={`${s.inquiries_closed ?? 0} closed`}
        />
      </section>

      <section className="stack">
        <h2>Requests filed per day</h2>
        <div className="card">
          <VolumeChart rows={rows} />
        </div>
      </section>

      <section className="stack">
        <h2>Daily breakdown</h2>
        <div className="scroller">
          <table>
            <thead>
              <tr><th>Day</th><th>Filed</th><th>Completed</th><th>Queue tickets</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td className="mono">{r.day}</td>
                  <td className="mono">{r.filed}</td>
                  <td className="mono">{r.completed}</td>
                  <td className="mono">{r.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2>Export</h2>
        <p className="muted" style={{ fontSize: '.92rem' }}>
          CSV rather than server-generated PDF: free Vercel functions stop at ten seconds,
          which a full-semester report will exceed. Open these in Excel.
        </p>
        <div className="row">
          <a className="btn ghost" href={csv('requests')}>Requests</a>
          <a className="btn ghost" href={csv('appointments')}>Appointments</a>
          <a className="btn ghost" href={csv('tickets')}>Queue tickets</a>
          <a className="btn ghost" href={csv('inquiries')}>Inquiries</a>
        </div>
      </section>
    </main>
  );
}
