import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, scopeLabel } from '@/lib/staff';
import type { Department } from '@/lib/types';

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

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
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
