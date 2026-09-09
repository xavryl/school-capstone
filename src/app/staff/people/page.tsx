import { createClient } from '@/lib/supabase/server';
import { getStaffGate } from '@/lib/staff';
import type { Department } from '@/lib/types';
import PersonRow, { type Person } from './PersonRow';

export const dynamic = 'force-dynamic';

type ProfileRow = { id: string; full_name: string; student_no: string | null };
type StaffRow = { user_id: string; department: Department; is_admin: boolean };

export default async function StaffAccountsPage() {
  const gate = await getStaffGate();
  if (gate.state !== 'ok') return null;

  if (!gate.ctx.isAdmin) {
    return (
      <div className="stack-lg">
        <header className="stack">
          <span className="eyebrow">Administrator only</span>
          <h1>Staff accounts</h1>
          <p className="lede">
            Only an administrator can assign offices. Ask whoever holds that role.
          </p>
        </header>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: profiles }, { data: staff }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, student_no').order('full_name'),
    supabase.from('staff').select('user_id, department, is_admin'),
  ]);

  const byUser = new Map(((staff ?? []) as StaffRow[]).map((s) => [s.user_id, s]));

  const people: Person[] = ((profiles ?? []) as ProfileRow[]).map((p) => {
    const s = byUser.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      student_no: p.student_no,
      department: s?.department ?? null,
      is_admin: s?.is_admin ?? false,
      isSelf: p.id === gate.ctx.userId,
    };
  });

  // Staff first, then everyone else -- the list is mostly students.
  people.sort((a, b) => {
    if (!!a.department !== !!b.department) return a.department ? -1 : 1;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  const staffCount = people.filter((p) => p.department).length;

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">Administrator</span>
        <h1>Staff accounts</h1>
        <p className="lede">
          Assign an office to turn an account into staff. This is the same thing the
          setup SQL does, without the SQL editor.
        </p>
      </header>

      <div className="aside-card">
        <h3>Where do the names come from?</h3>
        <p className="muted small">
          Everyone who has registered appears here — the list is mostly students. An
          account only reaches the console once you give it an office. Administrators
          see both offices and can produce reports for either.
        </p>
      </div>

      <section className="stack">
        <h2>{staffCount} staff &middot; {people.length} accounts</h2>
        <div className="scroller">
          <table>
            <thead>
              <tr><th>Name</th><th>Office</th><th>Role</th><th></th></tr>
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
    </div>
  );
}
