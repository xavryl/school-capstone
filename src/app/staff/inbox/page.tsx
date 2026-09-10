import { createClient } from '@/lib/supabase/server';
import { getStaffGate, scopeLabel } from '@/lib/staff';
import InboxClient, { type Ticket, type Colleague } from './InboxClient';
import Live from '../Live';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

type RosterRow = {
  user_id: string;
  full_name: string;
  department: string;
  role: 'staff' | 'head';
};

export default async function InboxPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const supabase = await createClient();

  const [{ data: raw, error: inboxError }, { data: roster }] = await Promise.all([
    supabase.rpc('office_inbox', { p_days: 14 }),
    // Only a head hands work out, so only a head needs the roster.
    ctx.canManage
      ? supabase.rpc('office_roster')
      : Promise.resolve({ data: [] as RosterRow[] }),
  ]);

  const tickets = ((raw ?? []) as Ticket[]).filter((t) =>
    ctx.departments.includes(t.department as never),
  );

  const colleagues: Colleague[] = ((roster ?? []) as RosterRow[])
    .filter((r) => ctx.departments.includes(r.department as never))
    .map((r) => ({ id: r.user_id, name: r.full_name || 'Unnamed account' }));

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
          <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
          <Live tables={['requests', 'inquiries']} />
        </span>
        <h1>Inbox</h1>
        <p className="lede">
          Every concern that reaches this office, newest first. Green means nobody has
          taken it, yellow that somebody is on it, red that it is done.
        </p>
      </header>

      {inboxError && (
        <p className="notice bad">
          The inbox needs{' '}
          <span className="mono">supabase/migrations/0011_inbox_view.sql</span> run in the
          Supabase SQL editor.
        </p>
      )}

      <InboxClient
        tickets={tickets}
        colleagues={colleagues}
        canManage={ctx.canManage}
        showDepartment={ctx.departments.length > 1}
        meId={ctx.userId}
      />
    </div>
  );
}
