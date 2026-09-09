import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Sign in to manage your profile</h1>
        <div className="row">
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </main>
    );
  }

  const [{ data: profile }, { data: staffRow }] = await Promise.all([
    supabase.from('profiles').select('full_name, student_no').eq('id', user.id).maybeSingle(),
    supabase.from('staff').select('department, is_admin').eq('user_id', user.id).maybeSingle(),
  ]);

  const role = staffRow
    ? staffRow.is_admin
      ? 'Administrator'
      : `${staffRow.department} staff`
    : 'School member';

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Account</span>
        <h1>Your profile</h1>
        <p className="lede">
          The name here is what the office sees on your requests, so make it match your
          school records.
        </p>
      </header>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <span className="label">Signed in as</span>
            <div className="mono">{user.email}</div>
          </span>
          <span className="pill on" style={{ textTransform: 'capitalize' }}>{role}</span>
        </div>
      </div>

      <ProfileForm
        fullName={profile?.full_name ?? ''}
        studentNo={profile?.student_no ?? ''}
      />

      <div className="card stack">
        <h2>Sign out</h2>
        <p className="muted">
          Ends the session on this device and clears the cookie. Do this on shared or
          lobby computers.
        </p>
        <form action={signOut}>
          <button className="ghost">Sign out securely</button>
        </form>
      </div>
    </main>
  );
}
