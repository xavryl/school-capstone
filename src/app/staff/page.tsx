import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department, QueueTicket, ServiceWindow } from '@/lib/types';
import QueueConsole from './QueueConsole';
import RequestRow from './RequestRow';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Staff sign-in required</h1>
        <p className="lede">This console is for registrar and treasury personnel.</p>
        <div className="row"><Link className="btn" href="/login">Sign in</Link></div>
      </main>
    );
  }

  // RLS would hide the rows anyway; this is for a readable message.
  const { data: me } = await supabase
    .from('staff').select('department, is_admin').eq('user_id', user.id).maybeSingle();

  if (!me) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Not a staff account</h1>
        <p className="lede">
          Your account is signed in but is not attached to a department. An administrator
          adds you with the snippet at the bottom of <span className="mono">0004_seed.sql</span>.
        </p>
      </main>
    );
  }

  const dept = me.department as Department;

  const [{ data: windows }, { data: tickets }, { data: requests }, { data: inquiries }] =
    await Promise.all([
      supabase.from('service_windows').select('*').eq('department', dept).eq('active', true).order('id'),
      supabase.from('queue_tickets').select('*')
        .eq('department', dept).eq('service_date', new Date().toISOString().slice(0, 10))
        .order('created_at'),
      supabase.from('requests').select('id, reference, status, details, created_at, services(name)')
        .eq('department', dept).neq('status', 'completed').order('created_at').limit(50),
      supabase.from('inquiries').select('id, reference, subject, name, status, created_at')
        .eq('department', dept).neq('status', 'closed').order('created_at').limit(25),
    ]);

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow" style={{ textTransform: 'uppercase' }}>{dept} console</span>
        <h1>Queue and transactions</h1>
        <p className="lede">
          Signed in as {user.email}{me.is_admin ? ' \u00b7 administrator' : ''}.
        </p>
      </header>

      <section className="stack">
        <h2>Queue</h2>
        <QueueConsole
          dept={dept}
          windows={(windows ?? []) as ServiceWindow[]}
          tickets={(tickets ?? []) as QueueTicket[]}
        />
      </section>

      <section className="stack">
        <h2>Open requests &middot; {requests?.length ?? 0}</h2>
        <div className="scroller">
          <table>
            <thead>
              <tr><th>Reference</th><th>Service</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody>
              {(requests ?? []).length === 0 && (
                <tr><td colSpan={4} className="muted">No open requests.</td></tr>
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(requests ?? []).map((r: any) => (
                <RequestRow key={r.id} row={{ ...r, services: Array.isArray(r.services) ? r.services[0] : r.services }} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2>Open inquiries &middot; {inquiries?.length ?? 0}</h2>
        <div className="scroller">
          <table>
            <thead>
              <tr><th>Reference</th><th>From</th><th>Subject</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(inquiries ?? []).length === 0 && (
                <tr><td colSpan={4} className="muted">No open inquiries.</td></tr>
              )}
              {(inquiries ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.reference}</td>
                  <td>{i.name}</td>
                  <td>{i.subject}</td>
                  <td><span className="pill warn">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
