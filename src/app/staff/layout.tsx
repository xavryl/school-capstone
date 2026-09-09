import Link from 'next/link';
import { Suspense } from 'react';
import { getStaffGate } from '@/lib/staff';
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

  return (
    <main className="wrap staff-shell">
      <Suspense fallback={<aside className="staff-side" />}>
        <StaffSidebar isAdmin={ctx.isAdmin} home={ctx.home} scope={ctx.scope} />
      </Suspense>
      <div className="staff-main">{children}</div>
    </main>
  );
}
