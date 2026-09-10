import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, daysAgo } from '@/lib/staff';
import type { Department } from '@/lib/types';
import { Donut, HourBars, Bars, TrendLines, type TrendRow } from '../Charts';

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

type DailyRow = { day: string; filed: number; completed: number; tickets: number };

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;

/**
 * A figure with what it was last time beside it. A dashboard that only says
 * "142 requests" makes you remember what the last fortnight was; showing the
 * change is the difference between a number and a finding.
 */
function Kpi({
  label,
  value,
  now,
  before,
  hint,
  goodWhen = 'up',
}: {
  label: string;
  value: string;
  now?: number;
  before?: number;
  hint?: string;
  goodWhen?: 'up' | 'down';
}) {
  let delta: null | { text: string; tone: 'good' | 'bad' | 'flat' } = null;

  if (now != null && before != null) {
    if (before === 0 && now === 0) {
      delta = { text: 'no change', tone: 'flat' };
    } else if (before === 0) {
      delta = { text: 'new', tone: goodWhen === 'up' ? 'good' : 'bad' };
    } else {
      const pct = Math.round(((now - before) / before) * 100);
      const tone =
        pct === 0 ? 'flat' : (pct > 0) === (goodWhen === 'up') ? 'good' : 'bad';
      delta = { text: `${pct > 0 ? '+' : ''}${pct}%`, tone };
    }
  }

  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-foot">
        {delta && <span className={`delta ${delta.tone}`}>{delta.text}</span>}
        {hint && <span className="tile-hint">{hint}</span>}
      </span>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const gate = await getStaffGate(sp.dept);
  if (gate.state !== 'ok') return null;

  // Reports are a management view: the office administrator and the system
  // administrator. Counter staff work their inbox, not the numbers.
  if (!gate.ctx.canManage) {
    return (
      <div className="stack-lg">
        <header className="stack">
          <span className="eyebrow">Office administrator only</span>
          <h1>Reports</h1>
          <p className="lede">
            Only your office administrator, or a system administrator, can pull these
            figures. Ask whoever holds that level.
          </p>
        </header>
      </div>
    );
  }

  // Reports are per office: a combined figure would hide which one is busy,
  // so 'all' falls back to the administrator's own office and the sidebar is
  // where you switch.
  const dept: Department = gate.ctx.scope === 'all' ? gate.ctx.home : gate.ctx.scope;
  const canSwitch = gate.ctx.isAdmin;

  const supabase = await createClient();

  const to = sp.to ?? today();
  const from = sp.from ?? daysAgo(13);

  // The period immediately before this one, of the same length, so every
  // figure below can be read against what it was.
  const span = Math.max(
    1,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS) + 1,
  );
  const prevTo = iso(new Date(new Date(from).getTime() - DAY_MS));
  const prevFrom = iso(new Date(new Date(from).getTime() - span * DAY_MS));

  const [
    { data: summary },
    { data: prevSummary },
    { data: daily },
    { data: reqRows },
    { data: services },
    { data: ticketRows },
  ] = await Promise.all([
    supabase.rpc('report_summary', { dept, p_from: from, p_to: to }),
    supabase.rpc('report_summary', { dept, p_from: prevFrom, p_to: prevTo }),
    supabase.rpc('report_daily', { dept, p_from: from, p_to: to }),
    supabase
      .from('requests')
      .select('service_id, status, created_at')
      .eq('department', dept)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .limit(5000),
    supabase.from('services').select('id, name').eq('department', dept),
    supabase
      .from('queue_tickets')
      .select('created_at, state, service_date')
      .eq('department', dept)
      .gte('service_date', from)
      .lte('service_date', to)
      .limit(5000),
  ]);

  const s = (summary ?? {}) as Partial<Summary>;
  const prev = (prevSummary ?? {}) as Partial<Summary>;

  const rows = ((daily ?? []) as DailyRow[]).map((r) => ({
    day: String(r.day).slice(0, 10),
    filed: num(r.filed),
    completed: num(r.completed),
    tickets: num(r.tickets),
  }));

  const trend: TrendRow[] = rows.map((r) => ({ day: r.day, a: r.filed, b: r.completed }));

  // Where requests ended up. Cancelled is what is left once completed and
  // still-open are taken off the total.
  const reqTotal = num(s.requests_total);
  const reqDone = num(s.requests_completed);
  const reqOpen = num(s.requests_open);
  const reqCancelled = Math.max(0, reqTotal - reqDone - reqOpen);

  const tickets = num(s.tickets);
  const served = num(s.tickets_served);
  const skipped = num(s.tickets_skipped);
  const unfinished = Math.max(0, tickets - served - skipped);

  const completionRate = reqTotal === 0 ? null : Math.round((reqDone / reqTotal) * 100);

  // Top services over the period, tallied from rows that are already here
  // rather than another round trip.
  const names = new Map(((services ?? []) as { id: number; name: string }[])
    .map((x) => [x.id, x.name]));
  const svcTally = new Map<string, number>();
  for (const r of (reqRows ?? []) as { service_id: number }[]) {
    const n = names.get(r.service_id) ?? 'Other';
    svcTally.set(n, (svcTally.get(n) ?? 0) + 1);
  }
  const topServices = [...svcTally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const svcMax = Math.max(1, ...topServices.map((r) => r.count));

  // When the counter is actually busy, over the whole period.
  const hours: Record<number, number> = {};
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  for (const t of (ticketRows ?? []) as { created_at: string; service_date: string }[]) {
    const h = new Date(t.created_at).getHours();
    hours[h] = (hours[h] ?? 0) + 1;
    weekday[new Date(`${t.service_date}T12:00:00`).getDay()] += 1;
  }
  // Sunday last: a school week reads Monday to Saturday.
  const weekBars = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    label: WEEKDAYS[d],
    value: weekday[d],
  }));

  const range = (f: string, t: string) => {
    const q = new URLSearchParams({ from: f, to: t });
    if (canSwitch) q.set('dept', dept);
    return `/staff/reports?${q.toString()}`;
  };

  const presets = [
    { label: '7 days', from: daysAgo(6), to: today() },
    { label: '14 days', from: daysAgo(13), to: today() },
    { label: '30 days', from: daysAgo(29), to: today() },
    { label: '90 days', from: daysAgo(89), to: today() },
  ];

  const csv = (type: string) =>
    `/staff/reports/export?type=${type}&from=${from}&to=${to}&dept=${dept}`;

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow" style={{ textTransform: 'uppercase' }}>{dept} reports</span>
        <h1>Transactions and queue statistics</h1>
        <p className="lede">
          {span} days, {from} to {to}. Every figure is set against the {span} days before
          it, so a number that moved says so.
        </p>

        <div className="mailbar">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={range(p.from, p.to)}
              className={`mailfilter${from === p.from && to === p.to ? ' on' : ''}`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form className="row" style={{ alignItems: 'flex-end' }}>
          {canSwitch && (
            <label className="field" style={{ maxWidth: '10rem' }}>
              <span className="label">Office</span>
              <select name="dept" defaultValue={dept}>
                <option value="registrar">Registrar</option>
                <option value="treasury">Treasury</option>
              </select>
            </label>
          )}
          <label className="field" style={{ maxWidth: '10rem' }}>
            <span className="label">From</span>
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label className="field" style={{ maxWidth: '10rem' }}>
            <span className="label">To</span>
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button className="ghost" style={{ alignSelf: 'end' }}>Apply</button>
        </form>
      </header>

      <section className="tiles">
        <Kpi
          label="Requests filed"
          value={String(reqTotal)}
          now={reqTotal}
          before={num(prev.requests_total)}
        />
        <Kpi
          label="Completed"
          value={String(reqDone)}
          now={reqDone}
          before={num(prev.requests_completed)}
          hint={completionRate == null ? undefined : `${completionRate}% of those filed`}
        />
        <Kpi
          label="Still open"
          value={String(reqOpen)}
          now={reqOpen}
          before={num(prev.requests_open)}
          goodWhen="down"
        />
        <Kpi
          label="Queue numbers"
          value={String(tickets)}
          now={tickets}
          before={num(prev.tickets)}
          hint={`${served} served · ${skipped} skipped`}
        />
        <Kpi
          label="Average wait"
          value={s.avg_wait_minutes == null ? '—' : `${s.avg_wait_minutes} min`}
          now={s.avg_wait_minutes ?? undefined}
          before={prev.avg_wait_minutes ?? undefined}
          goodWhen="down"
          hint="Issued to called"
        />
        <Kpi
          label="Appointments"
          value={String(num(s.appointments))}
          now={num(s.appointments)}
          before={num(prev.appointments)}
        />
        <Kpi
          label="Inquiries"
          value={String(num(s.inquiries))}
          now={num(s.inquiries)}
          before={num(prev.inquiries)}
          hint={`${num(s.inquiries_closed)} closed`}
        />
      </section>

      <section className="stack">
        <h2>Keeping pace</h2>
        <div className="charts">
          <div className="card chart-card wide">
            <h3>Filed against completed, per day</h3>
            <TrendLines rows={trend} aLabel="Filed" bLabel="Completed" />
            <p className="muted small">
              When the dashed line sits under the filled one for days on end the backlog
              is growing — that reading is what this chart is for.
            </p>
          </div>

          <div className="card chart-card">
            <h3>Where requests ended up</h3>
            <Donut
              centreLabel="requests"
              slices={[
                { label: 'Completed', value: reqDone, color: 'var(--good)' },
                { label: 'Still open', value: reqOpen, color: 'var(--signal)' },
                { label: 'Cancelled', value: reqCancelled, color: 'var(--bad)' },
              ]}
            />
          </div>

          <div className="card chart-card">
            <h3>Queue outcomes</h3>
            <Donut
              centreLabel="numbers"
              slices={[
                { label: 'Served', value: served, color: 'var(--good)' },
                { label: 'Skipped', value: skipped, color: 'var(--bad)' },
                { label: 'Unfinished', value: unfinished, color: 'var(--faint)' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>When the counter is busy</h2>
        <div className="charts">
          <div className="card chart-card">
            <h3>By hour</h3>
            <HourBars hours={hours} />
            <p className="muted small">
              Every number issued in the period, by the hour it was taken.
            </p>
          </div>

          <div className="card chart-card">
            <h3>By day of the week</h3>
            <Bars bars={weekBars} />
            <p className="muted small">
              Which day carries the load, which is what a roster is decided on.
            </p>
          </div>

          <div className="card chart-card wide">
            <h3>What was asked for</h3>
            {topServices.length === 0 ? (
              <p className="muted">No requests were filed in this period.</p>
            ) : (
              <div className="svc-list">
                {topServices.map((r) => (
                  <div key={r.name} className="svc-row">
                    <span className="svc-name">{r.name}</span>
                    <span className="svc-bar" aria-hidden="true">
                      <span style={{ width: `${(r.count / svcMax) * 100}%` }} />
                    </span>
                    <span className="svc-count mono">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Day by day</h2>
        <details className="details">
          <summary>Show the {rows.length} rows behind these charts</summary>
          <div className="scroller">
            <table>
              <thead>
                <tr><th>Day</th><th>Filed</th><th>Completed</th><th>Queue numbers</th></tr>
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
        </details>
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
          <a className="btn ghost" href={csv('tickets')}>Queue numbers</a>
          <a className="btn ghost" href={csv('inquiries')}>Inquiries</a>
        </div>
      </section>
    </div>
  );
}
