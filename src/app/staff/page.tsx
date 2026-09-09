import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type {
  Department, InquiryStatus, QueueTicket, Service, ServiceWindow,
} from '@/lib/types';
import QueueConsole from './QueueConsole';
import RequestRow, { type Attachment } from './RequestRow';
import InquiryRow from './InquiryRow';
import AppointmentList, { type StaffAppointment } from './AppointmentList';

export const dynamic = 'force-dynamic';

type RequestJoin = {
  id: string;
  reference: string;
  status: string;
  details: string;
  created_at: string;
  services: { name: string }[] | { name: string } | null;
  request_attachments: Attachment[] | null;
};

type InquiryRecord = {
  id: string;
  reference: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: InquiryStatus;
  response: string | null;
  created_at: string;
};

const one = <T,>(v: T[] | T | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Staff sign-in required</h1>
        <p className="lede">This console is for registrar and treasury personnel.</p>
        <div className="row"><Link className="btn" href="/login">Sign in</Link></div>
      </main>
    );
  }

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
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: windows },
    { data: services },
    { data: tickets },
    { data: requests },
    { data: inquiries },
    { data: appointments },
    { data: banner },
  ] = await Promise.all([
    supabase.from('service_windows').select('*')
      .eq('department', dept).eq('active', true).order('id'),
    supabase.from('services').select('*')
      .eq('department', dept).eq('active', true).order('id'),
    supabase.from('queue_tickets').select('*')
      .eq('department', dept).eq('service_date', today).order('created_at'),
    supabase.from('requests')
      .select('id, reference, status, details, created_at, services(name), request_attachments(path, filename)')
      .eq('department', dept).neq('status', 'completed').order('created_at').limit(50),
    supabase.from('inquiries').select('*')
      .eq('department', dept).neq('status', 'closed').order('created_at').limit(25),
    supabase.from('appointments')
      .select('id, starts_at, status, service_windows(label)')
      .gte('starts_at', `${today}T00:00:00`)
      .lte('starts_at', `${today}T23:59:59`)
      .order('starts_at'),
    supabase.from('queue_announcements').select('message')
      .eq('department', dept).eq('active', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const requestRows = ((requests ?? []) as RequestJoin[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status as never,
    details: r.details,
    created_at: r.created_at,
    services: one(r.services),
    attachments: r.request_attachments ?? [],
  }));

  const appointmentRows = ((appointments ?? []) as {
    id: string; starts_at: string; status: string;
    service_windows: { label: string }[] | { label: string } | null;
  }[]).map<StaffAppointment>((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    status: a.status,
    window_label: one(a.service_windows)?.label ?? 'Window',
  }));

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow" style={{ textTransform: 'uppercase' }}>{dept} console</span>
          <span className="row" style={{ gap: '.5rem' }}>
            <Link className="btn ghost" href={`/display/${dept}`}>Lobby screen</Link>
            <Link className="btn ghost" href="/staff/reports">Reports</Link>
          </span>
        </div>
        <h1>Queue and transactions</h1>
        <p className="lede">
          Signed in as {user.email}{me.is_admin ? ' · administrator' : ''}.
        </p>
      </header>

      <section className="stack">
        <h2>Queue</h2>
        <QueueConsole
          dept={dept}
          windows={(windows ?? []) as ServiceWindow[]}
          services={(services ?? []) as Service[]}
          tickets={(tickets ?? []) as QueueTicket[]}
          announcement={banner?.message ?? ''}
        />
      </section>

      <section className="stack">
        <h2>Today&rsquo;s appointments &middot; {appointmentRows.length}</h2>
        <AppointmentList rows={appointmentRows} />
      </section>

      <section className="stack">
        <h2>Open requests &middot; {requestRows.length}</h2>
        <div className="scroller">
          <table>
            <thead>
              <tr><th>Reference</th><th>Service &amp; documents</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody>
              {requestRows.length === 0 && (
                <tr><td colSpan={4} className="muted">No open requests.</td></tr>
              )}
              {requestRows.map((r) => <RequestRow key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2>Open inquiries &middot; {(inquiries ?? []).length}</h2>
        {(inquiries ?? []).length === 0 && <p className="muted">No open inquiries.</p>}
        {((inquiries ?? []) as InquiryRecord[]).map((i) => (
          <InquiryRow key={i.id} row={i} />
        ))}
      </section>
    </main>
  );
}
