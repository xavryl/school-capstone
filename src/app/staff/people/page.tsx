import { createClient } from '@/lib/supabase/server';
import { getStaffGate, scopeLabel } from '@/lib/staff';
import type { Department } from '@/lib/types';
import PersonRow, { type Person } from './PersonRow';
import RosterRow, { type RosterPerson } from './RosterRow';
import NewStaffForm from './NewStaffForm';

export const dynamic = 'force-dynamic';

type ProfileRow = { id: string; full_name: string; student_no: string | null };
type StaffRow = {
  user_id: string;
  department: Department;
  role: 'staff' | 'head';
  is_admin: boolean;
};
type RosterRowData = StaffRow & { full_name: string };

export default async function StaffAccountsPage() {
  const gate = await getStaffGate();
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  if (!ctx.canManage) {
    return (
      <div className="stack-lg">
        <header className="stack">
          <span className="eyebrow">Office administrator only</span>
          <h1>Staff accounts</h1>
          <p className="lede">
            Your office administrator opens the accounts for this counter. Ask whoever
            holds that level.
          </p>
        </header>
      </div>
    );
  }

  const supabase = await createClient();

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">
          {ctx.isAdmin ? 'System administrator' : `${scopeLabel(ctx.scope)} office`}
        </span>
        <h1>Staff accounts</h1>
        <p className="lede">
          {ctx.isAdmin
            ? 'Open a login for anybody, and set which office and level an existing account holds.'
            : 'Open a login for someone on your counter. They see this office only, and only the work that reaches them.'}
        </p>
      </header>

      <section className="stack">
        <h2>New staff account</h2>
        <div className="card">
          <NewStaffForm
            offices={ctx.isAdmin ? (['registrar', 'treasury'] as Department[]) : [ctx.home]}
            home={ctx.home}
          />
        </div>
      </section>

      {ctx.isAdmin ? <EveryoneTable /> : <OfficeRoster />}
    </div>
  );

  /** What a system administrator sees: every account, and the level dropdown. */
  async function EveryoneTable() {
    const [{ data: profiles }, { data: staff }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_no').order('full_name'),
      supabase.from('staff').select('*'),
    ]);

    const byUser = new Map(((staff ?? []) as StaffRow[]).map((s) => [s.user_id, s]));

    const people: Person[] = ((profiles ?? []) as ProfileRow[]).map((p) => {
      const s = byUser.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        student_no: p.student_no,
        department: s?.department ?? null,
        role: s?.role ?? 'staff',
        is_admin: s?.is_admin ?? false,
        isSelf: p.id === ctx.userId,
      };
    });

    // Staff first, then everyone else -- the list is mostly students.
    people.sort((a, b) => {
      if (!!a.department !== !!b.department) return a.department ? -1 : 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    const staffCount = people.filter((p) => p.department).length;

    return (
      <>
        <div className="aside-card">
          <h3>What the three levels mean</h3>
          <p className="muted small">
            <strong>Office staff</strong> work the inbox: they take concerns addressed to
            their office and answer them. An <strong>office administrator</strong> runs one
            office — the registrar administrator sees registrar work and nothing of
            treasury&rsquo;s, and the other way round. Only a{' '}
            <strong>system administrator</strong> sees both, and only they can change this
            table.
          </p>
        </div>

        <section className="stack">
          <h2>{staffCount} staff &middot; {people.length} accounts</h2>
          <p className="muted">
            Everyone who has registered appears here — the list is mostly students. An
            account only reaches the console once you give it an office.
          </p>
          <div className="scroller">
            <table>
              <thead>
                <tr><th>Name</th><th>Office</th><th>Level</th><th></th></tr>
              </thead>
              <tbody>
                {people.length === 0 && (
                  <tr><td colSpan={4} className="muted">Nobody has registered yet.</td></tr>
                )}
                {people.map((p) => <PersonRow key={p.id} person={p} />)}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  /**
   * What an office administrator sees: their own counter, and nobody else's.
   * The roster comes from a function rather than a query because the select
   * policy on `staff` is per-row and would not join the names on.
   */
  async function OfficeRoster() {
    const { data, error } = await supabase.rpc('office_roster');
    const rows = ((data ?? []) as RosterRowData[]).filter((r) =>
      ctx.departments.includes(r.department),
    );

    const people: RosterPerson[] = rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      level: r.is_admin
        ? 'System administrator'
        : r.role === 'head'
          ? 'Office administrator'
          : 'Office staff',
      // A head runs their counter staff, not their peers.
      removable: !r.is_admin && r.role === 'staff' && r.user_id !== ctx.userId,
      isSelf: r.user_id === ctx.userId,
    }));

    return (
      <section className="stack">
        <h2>Your office &middot; {people.length}</h2>

        {error && (
          <p className="notice bad">
            The roster needs{' '}
            <span className="mono">supabase/migrations/0010_office_roster_and_realtime.sql</span>{' '}
            run in the Supabase SQL editor.
          </p>
        )}

        <p className="muted">
          Removing somebody takes them off the counter. Their login survives — it simply
          stops being staff, so it can be put back without opening a new account.
        </p>

        <div className="scroller">
          <table>
            <thead>
              <tr><th>Name</th><th>Level</th><th></th></tr>
            </thead>
            <tbody>
              {people.length === 0 && (
                <tr><td colSpan={3} className="muted">Nobody yet. Open an account above.</td></tr>
              )}
              {people.map((p) => <RosterRow key={p.user_id} person={p} />)}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
}
