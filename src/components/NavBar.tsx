import { createClient } from '@/lib/supabase/server';
import NavClient from './NavClient';

/**
 * Server shell: reads the session and unread count, then hands them to the
 * client half that owns the active-link state and the mobile panel.
 *
 * Wrapped in try/catch so the app still renders before the migrations have
 * been run -- otherwise a missing table 500s every page in the site.
 */
export default async function NavBar() {
  let email: string | null = null;
  let unread = 0;
  let isStaff = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      email = user.email ?? null;
      const [{ count }, { data: staffRow }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null),
        supabase.from('staff').select('user_id').eq('user_id', user.id).maybeSingle(),
      ]);
      unread = count ?? 0;
      isStaff = Boolean(staffRow);
    }
  } catch {
    // No credentials yet, tables not created, or the project is asleep.
  }

  return <NavClient email={email} unread={unread} isStaff={isStaff} />;
}
