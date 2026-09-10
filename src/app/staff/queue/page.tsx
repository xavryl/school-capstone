import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, scopeLabel } from '@/lib/staff';
import type { Department, QueueTicket, Service, ServiceWindow } from '@/lib/types';
import QueueConsole from '../QueueConsole';
import Live from '../Live';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function QueuePage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const supabase = await createClient();
  const day = today();

  // One console per office in scope. Calling a queue is inherently per-office
  // -- a window belongs to one -- so an admin viewing both gets two consoles
  // rather than one that would have to ask which office every time.
  const consoles = await Promise.all(
    ctx.departments.map(async (d: Department) => {
      const [{ data: windows }, { data: services }, { data: tickets }, { data: banner }] =
        await Promise.all([
          supabase.from('service_windows').select('*')
            .eq('department', d).eq('active', true).order('id'),
          supabase.from('services').select('*')
            .eq('department', d).eq('active', true).order('id'),
          supabase.from('queue_tickets').select('*')
            .eq('department', d).eq('service_date', day).order('created_at'),
          supabase.from('queue_announcements').select('message')
            .eq('department', d).eq('active', true)
            .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

      return {
        department: d,
        windows: (windows ?? []) as ServiceWindow[],
        services: (services ?? []) as Service[],
        tickets: (tickets ?? []) as QueueTicket[],
        announcement: banner?.message ?? '',
      };
    }),
  );

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
          <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
          <Live tables={['queue_tickets']} />
        </span>
        <h1>Queue</h1>
        <p className="lede">
          Calling completes whoever was at your window, promotes the oldest waiting
          ticket, and announces it on the lobby screen.
        </p>
      </header>

      {consoles.map((c) => (
        <section key={c.department} className="stack">
          {ctx.departments.length > 1 && (
            <h2 style={{ textTransform: 'capitalize' }}>{c.department}</h2>
          )}
          <QueueConsole
            dept={c.department}
            windows={c.windows}
            services={c.services}
            tickets={c.tickets}
            announcement={c.announcement}
          />
        </section>
      ))}
    </div>
  );
}
