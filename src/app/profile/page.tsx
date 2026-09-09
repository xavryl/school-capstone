import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import type { Profile } from '@/lib/profile';
import ProfileEditor from './ProfileEditor';
import CredentialsCard from './CredentialsCard';

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
    supabase
      .from('profiles')
      .select('id, full_name, student_no, avatar_path, banner_path, bio, program, year_level, contact_number')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('staff').select('department, is_admin').eq('user_id', user.id).maybeSingle(),
  ]);

  const role = staffRow
    ? staffRow.is_admin ? 'Administrator' : `${staffRow.department} staff`
    : 'School member';

  // The row is created by the handle_new_user trigger; this fallback keeps the
  // page usable if the migrations were run after the account was made.
  const p: Profile = (profile as Profile) ?? {
    id: user.id,
    full_name: '',
    student_no: null,
    avatar_path: null,
    banner_path: null,
    bio: null,
    program: null,
    year_level: null,
    contact_number: null,
  };

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">Account</span>
          <span className="pill on" style={{ textTransform: 'capitalize' }}>{role}</span>
        </div>
        <h1>Your profile</h1>
        <p className="lede">
          The name and number here are what the office sees on your requests, so make them
          match your school records.
        </p>
      </header>

      <ProfileEditor profile={p} email={user.email ?? ''} />

      <CredentialsCard email={user.email ?? ''} />

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
