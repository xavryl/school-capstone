import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getStaffGate, roleTitle } from '@/lib/staff';
import { mediaUrl } from '@/lib/profile';
import StaffSidebar from './StaffSidebar';

export const dynamic = 'force-dynamic';

/**
 * The gate lives here rather than in each page, so a new tab cannot be added
 * without it. Every /staff route inherits the same check and the same shell.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The layout cannot read searchParams, so scope resolution happens per page.
  // Here we only need to know whether this person may be in here at all.
  const gate = await getStaffGate();

  if (gate.state === 'anonymous') {
    return (
      <main className="wrap narrow stack-lg">
        <header className="stack">
          <span className="eyebrow">Staff</span>
          <h1>Sign in to continue</h1>
          <p className="lede">
            This console is for registrar and treasury personnel.
          </p>
        </header>
        <div className="row">
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </main>
    );
  }

  if (gate.state === 'not-staff') {
    return (
      <main className="wrap narrow stack-lg">
        <header className="stack">
          <span className="eyebrow">Staff</span>
          <h1>Not a staff account</h1>
          <p className="lede">
            You are signed in as {gate.email}, but that account is not attached to an
            office yet. An administrator can assign one under Staff accounts.
          </p>
        </header>
        <div className="row">
          <Link className="btn ghost" href="/">Back to the home page</Link>
        </div>
      </main>
    );
  }

  const { ctx } = gate;

  // The panel replaces the public bar on these routes, so it has to carry what
  // that bar carried: who you are, your unread count, your picture.
  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_path').eq('id', ctx.userId).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);

  return (
    <div className="console">
      <Suspense fallback={<aside className="console-side" />}>
        <StaffSidebar
          isAdmin={ctx.isAdmin}
          canManage={ctx.canManage}
          roleLabel={roleTitle(ctx)}
          scope={ctx.scope}
          name={profile?.full_name ?? ''}
          email={ctx.email}
          avatarUrl={mediaUrl(profile?.avatar_path)}
          unread={count ?? 0}
        />
      </Suspense>
      <div className="console-main">
        <div className="console-sheet">{children}</div>
      </div>
    </div>
  );
}
