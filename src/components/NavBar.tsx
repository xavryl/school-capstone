import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

/**
 * Server component: reads the session and the unread count on every render.
 * Wrapped in try/catch so the app still renders before Supabase credentials
 * exist -- otherwise every page 500s while you are still setting up.
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
    // No credentials yet, or the project is asleep. Render the public nav.
  }

  return (
    <nav className="topbar">
      <Link href="/" className="brand">One-Stop Services</Link>
      <Link href="/request">Request</Link>
      <Link href="/queue">Queue</Link>
      <Link href="/appointments">Appointments</Link>
      <Link href="/inquiry">Guest inquiry</Link>
      <Link href="/track">Track</Link>
      <span className="spacer" />
      {email ? (
        <>
          <Link href="/profile">Profile</Link>
          <Link href="/notifications">
            Updates{unread > 0 && <span className="badge">{unread}</span>}
          </Link>
          {isStaff && <Link href="/staff">Staff</Link>}
          <form action={signOut} style={{ display: 'inline' }}>
            <button className="ghost" style={{ padding: '.3rem .7rem', fontSize: '.85rem' }}>
              Sign out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/staff">Staff</Link>
          <Link href="/login">Sign in</Link>
        </>
      )}
    </nav>
  );
}
