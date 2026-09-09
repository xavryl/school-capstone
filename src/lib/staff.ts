import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Department } from '@/lib/types';

export type Scope = Department | 'all';

export type StaffContext = {
  userId: string;
  email: string;
  /** The office this person belongs to. Fixed for staff, the default for an admin. */
  home: Department;
  isAdmin: boolean;
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

  const { data: row } = await supabase
    .from('staff')
    .select('department, is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) return { state: 'not-staff', email: user.email ?? '' };

  const home = row.department as Department;
  const isAdmin = Boolean(row.is_admin);

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
      scope,
      departments: scope === 'all' ? ['registrar', 'treasury'] : [scope],
    },
  };
});

/** Today, as the date column stores it. */
export const today = () => new Date().toISOString().slice(0, 10);

export const scopeLabel = (scope: Scope) =>
  scope === 'all' ? 'Both offices' : scope === 'registrar' ? 'Registrar' : 'Treasury';
