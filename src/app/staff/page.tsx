import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, daysAgo, scopeLabel } from '@/lib/staff';
import type { Department } from '@/lib/types';
import Live from './Live';
import { Donut, HourBars, TrendLines, type TrendRow } from './Charts';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

type Row = { department: Department; label: string; value: number; hint?: string };

export default async function StaffOverview({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null; // the layout already explained why
  const { ctx } = gate;

  const supabase = await createClient();
  const day = today();

  // One set of counts per office in scope, so "Both" is a real comparison
  // rather than a single blended number that hides which office is busy.
  const perOffice = await Promise.all(
    ctx.departments.map(async (d) => {
      const [waiting, serving, doneToday, openReq, openInq, appts] = await Promise.all([
        supabase.from('queue_tickets').select('id', { count: 'exact', head: true })
          .eq('department', d).eq('service_date', day).eq('state', 'waiting'),
        supabase.from('queue_tickets').select('id', { count: 'exact', head: true })
          .eq('department', d).eq('service_date', day).eq('state', 'serving'),
        supabase.from('queue_tickets').select('id', { count: 'exact', head: true })
          .eq('department', d).eq('service_date', day).eq('state', 'completed'),
        supabase.from('requests').select('id', { count: 'exact', head: true })
          .eq('department', d).not('status', 'in', '("completed","cancelled")'),
        supabase.from('inquiries').select('id', { count: 'exact', head: true })
          .eq('department', d).neq('status', 'closed'),
        supabase.from('appointments').select('id, service_windows!inner(department)', {
          count: 'exact', head: true,
        })
          .eq('service_windows.department', d)
          .neq('status', 'cancelled')
          .gte('starts_at', `${day}T00:00:00`)
          .lte('starts_at', `${day}T23:59:59`),
      ]);

      return {
        department: d,
        waiting: waiting.count ?? 0,
        serving: serving.count ?? 0,
        doneToday: doneToday.count ?? 0,
        openReq: openReq.count ?? 0,
        openInq: openInq.count ?? 0,
        appts: appts.count ?? 0,
      };
    }),
  );

  const total = (k: keyof (typeof perOffice)[number]) =>
    perOffice.reduce((sum, o) => sum + (o[k] as number), 0);

  // Today's tickets in full, rather than six more count queries: the rows are
  // one day of one office, and having them makes both the ring and the hourly
  // shape free.
  const todaysTickets = (
    await Promise.all(
      ctx.departments.map(async (d) => {
        const { data } = await supabase
          .from('queue_tickets')
          .select('state, created_at')
          .eq('department', d)
          .eq('service_date', day);
        return (data ?? []) as { state: string; created_at: string }[];
      }),
    )
  ).flat();

  const skipped = todaysTickets.filter((t) => t.state === 'skipped').length;

  const hours: Record<number, number> = {};
  for (const t of todaysTickets) {
    const h = new Date(t.created_at).getHours();
    hours[h] = (hours[h] ?? 0) + 1;
  }

  // A fortnight of both offices in scope, summed by day.
  const from = daysAgo(13);
  const daily = await Promise.all(
    ctx.departments.map(async (d) => {
      const { data } = await supabase.rpc('report_daily', {
        dept: d, p_from: from, p_to: day,
      });
      return (data ?? []) as { day: string; filed: number; tickets: number }[];
    }),
  );

  const byDay = new Map<string, TrendRow>();
  for (const office of daily) {
    for (const r of office) {
      const key = String(r.day).slice(0, 10);
      const row = byDay.get(key) ?? { day: key, filed: 0, tickets: 0 };
      row.filed += Number(r.filed) || 0;
      row.tickets += Number(r.tickets) || 0;
      byDay.set(key, row);
    }
  }
  const trend = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  // The service mix is the substance of the difference between the two
  // consoles: certificates and transcripts on one side, receipts and
  // assessments on the other.
  const byService = await Promise.all(
    ctx.departments.map(async (d) => {
      const [{ data: services }, { data: open }] = await Promise.all([
        supabase.from('services').select('id, name').eq('department', d).eq('active', true),
        supabase.from('requests').select('service_id')
          .eq('department', d).not('status', 'in', '("completed","cancelled")'),
      ]);

      const names = new Map(((services ?? []) as { id: number; name: string }[])
        .map((s) => [s.id, s.name]));

      const tally = new Map<string, number>();
      for (const r of (open ?? []) as { service_id: number }[]) {
        const name = names.get(r.service_id) ?? 'Other';
        tally.set(name, (tally.get(name) ?? 0) + 1);
      }

      const rows = [...tally.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return { department: d, rows, max: Math.max(1, ...rows.map((r) => r.count)) };
    }),
  );

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
          <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
          <Live tables={['requests', 'inquiries', 'appointments', 'queue_tickets']} />
        </span>
        <h1>Today at a glance</h1>
        <p className="lede">
          {new Date().toLocaleDateString([], {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
          {ctx.isAdmin && ctx.scope === 'all' && ' — both offices combined below, each broken out underneath.'}
        </p>
      </header>

      <section className="tiles">
        <Tile label="Waiting now" value={total('waiting')} />
        <Tile label="At a window" value={total('serving')} />
        <Tile label="Served today" value={total('doneToday')} />
        <Tile label="Appointments today" value={total('appts')} />
        <Tile label="Open requests" value={total('openReq')} />
        <Tile label="Open inquiries" value={total('openInq')} />
      </section>

      <section className="stack">
        <h2>Today, and the fortnight behind it</h2>
        <div className="charts">
          <div className="card chart-card">
            <h3>Queue today</h3>
            <Donut
              centreLabel="numbers today"
              slices={[
                { label: 'Waiting', value: total('waiting'), color: 'var(--signal)' },
                { label: 'At a window', value: total('serving'), color: 'var(--accent)' },
                { label: 'Served', value: total('doneToday'), color: 'var(--good)' },
                { label: 'Skipped', value: skipped, color: 'var(--bad)' },
              ]}
            />
            <p className="muted small">
              {total('waiting') === 0
                ? 'Nobody is waiting at the moment.'
                : `${total('waiting')} still to be called.`}
            </p>
          </div>

          <div className="card chart-card">
            <h3>When people arrive</h3>
            <HourBars hours={hours} />
            <p className="muted small">
              Numbers issued per hour today. The rush is where you want the second
              window open.
            </p>
          </div>

          <div className="card chart-card wide">
            <h3>Last fortnight</h3>
            <TrendLines rows={trend} />
            <p className="muted small">
              Requests filed against queue numbers issued. Two lines because the same
              day can be quiet at the counter and busy online.
            </p>
          </div>
        </div>
      </section>

      {ctx.scope === 'all' && (
        <section className="stack">
          <h2>By office</h2>
          <div className="scroller">
            <table>
              <thead>
                <tr>
                  <th>Office</th><th>Waiting</th><th>At a window</th>
                  <th>Served</th><th>Appointments</th><th>Open requests</th><th>Open inquiries</th>
                </tr>
              </thead>
              <tbody>
                {perOffice.map((o) => (
                  <tr key={o.department}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {o.department}
                    </td>
                    <td className="mono">{o.waiting}</td>
                    <td className="mono">{o.serving}</td>
                    <td className="mono">{o.doneToday}</td>
                    <td className="mono">{o.appts}</td>
                    <td className="mono">{o.openReq}</td>
                    <td className="mono">{o.openInq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="stack">
        <h2>What people are asking for</h2>
        <p className="muted">
          {ctx.departments.length > 1
            ? 'Open requests by service. This is where the two offices genuinely differ — the registrar issues documents, the treasury settles money.'
            : 'Open requests by service, so you can see what today is actually made of.'}
        </p>
        <div className={ctx.departments.length > 1 ? 'grid2' : ''}>
          {byService.map((office) => (
            <div key={office.department} className="card">
              <h3 style={{ textTransform: 'capitalize' }}>{office.department}</h3>
              {office.rows.length === 0 ? (
                <p className="muted">No open requests for this office.</p>
              ) : (
                <div className="svc-list">
                  {office.rows.map((r) => (
                    <div key={r.name} className="svc-row">
                      <span className="svc-name">{r.name}</span>
                      <span className="svc-bar" aria-hidden="true">
                        <span style={{ width: `${(r.count / office.max) * 100}%` }} />
                      </span>
                      <span className="svc-count mono">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Jump to</h2>
        <div className="grid2">
          <Link href={link('/staff/queue', ctx.isAdmin, ctx.scope)} className="card">
            <h3>Call the next number</h3>
            <p className="muted">
              {total('waiting') === 0
                ? 'Nobody is waiting right now.'
                : `${total('waiting')} waiting across ${ctx.departments.length === 1 ? 'this office' : 'both offices'}.`}
            </p>
          </Link>
          <Link href={link('/staff/requests', ctx.isAdmin, ctx.scope)} className="card">
            <h3>Work through requests</h3>
            <p className="muted">
              {total('openReq') === 0 ? 'Nothing open.' : `${total('openReq')} still open.`}
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function link(href: string, isAdmin: boolean, scope: string) {
  return isAdmin ? `${href}?dept=${scope}` : href;
}

function Tile({ label, value, hint }: Omit<Row, 'department'>) {
  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="tile-value">{value}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}
