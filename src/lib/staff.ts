import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';

export type Scope = Department | 'all';

/** Two levels inside an office. A head runs it; staff work its counter. */
export type OfficeRole = 'staff' | 'head';

export type StaffContext = {
  userId: string;
  email: string;
  /** The office this person belongs to. Fixed for staff, the default for an admin. */
  home: Department;
  isAdmin: boolean;
  role: OfficeRole;
  /** A head or a system admin: may hand work out and read the office reports. */
  canManage: boolean;
  /** What is being looked at right now. Only an admin can widen this. */
  scope: Scope;
  /** The departments the current scope resolves to, for querying. */
  departments: Department[];
};

export type StaffGate =
  | { state: 'anonymous' }
  | { state: 'not-staff'; email: string }
  | { state: 'ok'; ctx: StaffContext };

const isDepartment = (v: unknown): v is Department =>
  v === 'registrar' || v === 'treasury';

/**
 * Resolves who is asking and what they are allowed to see, in one place, so no
 * page has to re-derive it. An ordinary staff member is pinned to their own
 * office no matter what ?dept says; only an administrator can widen the scope,
 * which is the whole difference between the two roles.
 */
// cache() so the layout and the page inside it share one lookup per request.
export const getStaffGate = cache(async (deptParam?: string): Promise<StaffGate> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { state: 'anonymous' };

  // '*' rather than a named list: before 0009 is run there is no `role`
  // column, and asking for it by name would fail the whole query and lock
  // every staff member out of the console.
  const { data: row } = await supabase
    .from('staff')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) return { state: 'not-staff', email: user.email ?? '' };

  const home = row.department as Department;
  const isAdmin = Boolean(row.is_admin);
  const role = (row.role as OfficeRole) ?? 'staff';

  let scope: Scope = home;
  if (isAdmin) {
    if (deptParam === 'all') scope = 'all';
    else if (isDepartment(deptParam)) scope = deptParam;
    else scope = 'all';
  }

  return {
    state: 'ok',
    ctx: {
      userId: user.id,
      email: user.email ?? '',
      home,
      isAdmin,
      role,
      canManage: isAdmin || role === 'head',
      scope,
      departments: scope === 'all' ? ['registrar', 'treasury'] : [scope],
    },
  };
});

/** Today, as the date column stores it. */
export const today = () => new Date().toISOString().slice(0, 10);

/** The same, n days back -- the start of a report or chart range. */
export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export const scopeLabel = (scope: Scope) =>
  scope === 'all' ? 'Both offices' : scope === 'registrar' ? 'Registrar' : 'Treasury';

/**
 * How a person is named to themselves and to colleagues. The three levels the
 * offices actually talk about: the system administrator who spans both, each
 * office's own administrator, and the staff who work its counter.
 */
export const roleTitle = (ctx: StaffContext) => {
  if (ctx.isAdmin) return 'System administrator';
  const office = ctx.home === 'registrar' ? 'Registrar' : 'Treasury';
  return ctx.role === 'head' ? `${office} administrator` : `${office} staff`;
};
