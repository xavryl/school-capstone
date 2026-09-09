import { createClient } from '@/lib/supabase/server';
import { getStaffGate, scopeLabel } from '@/lib/staff';
import TicketCard, { type Ticket, type Colleague } from './TicketCard';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function InboxPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const supabase = await createClient();

  // Two lists from one function: what is on you, and what nobody has taken.
  const [{ data: mineRaw, error: inboxError }, { data: poolRaw }, { data: staffRows }] = await Promise.all([
    supabase.rpc('my_inbox', { p_mine: true }),
    supabase.rpc('my_inbox', { p_mine: false }),
    supabase.from('staff').select('*'),
  ]);

  const inScope = (t: Ticket) => ctx.departments.includes(t.department as never);
  const mine = ((mineRaw ?? []) as Ticket[]).filter(inScope);
  const pool = ((poolRaw ?? []) as Ticket[]).filter(inScope);

  // Only a head hands work out, and only to their own office.
  let colleagues: Colleague[] = [];
  if (ctx.canManage) {
    const ids = ((staffRows ?? []) as { user_id: string; department: string }[])
      .filter((s) => ctx.departments.includes(s.department as never))
      .map((s) => s.user_id);

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', ids);
      colleagues = ((profiles ?? []) as { id: string; full_name: string }[])
        .map((p) => ({ id: p.id, name: p.full_name || 'Unnamed account' }));
    }
  }

  const showDept = ctx.departments.length > 1;

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
        <h1>Inbox</h1>
        <p className="lede">
          Concerns from students and guests, in one list. Requests and inquiries sit
          together here because at a counter they are the same job.
        </p>
      </header>

      {inboxError && (
        <p className="notice bad">
          The inbox is not set up on the database yet. Run
          {' '}<span className="mono">supabase/migrations/0009_roles_and_assignment.sql</span>
          {' '}in the Supabase SQL editor, then reload this page.
        </p>
      )}

      <section className="stack">
        <h2>On you &middot; {mine.length}</h2>
        {mine.length === 0 ? (
          <p className="muted">
            Nothing assigned to you. Take something from below, or wait for
            {ctx.canManage ? ' work to arrive.' : ' your office head to hand you one.'}
          </p>
        ) : (
          mine.map((t) => (
            <TicketCard
              key={`${t.kind}-${t.id}`}
              ticket={t}
              mine
              canManage={ctx.canManage}
              colleagues={colleagues}
              showDepartment={showDept}
            />
          ))
        )}
      </section>

      <section className="stack">
        <h2>Unclaimed &middot; {pool.length}</h2>
        <p className="muted">
          Nobody is handling these yet. Taking one puts your name on it so two people do
          not answer the same person twice.
        </p>
        {pool.length === 0 ? (
          <p className="muted">Nothing waiting. The office is caught up.</p>
        ) : (
          pool.map((t) => (
            <TicketCard
              key={`${t.kind}-${t.id}`}
              ticket={t}
              mine={false}
              canManage={ctx.canManage}
              colleagues={colleagues}
              showDepartment={showDept}
            />
          ))
        )}
      </section>
    </div>
  );
}
