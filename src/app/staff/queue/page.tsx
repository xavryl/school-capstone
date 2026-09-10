import { createClient } from '@/lib/supabase/server';
import { getStaffGate, today, scopeLabel } from '@/lib/staff';
import type {
  Department, QueueTicket, RequestStatus, Service, ServiceWindow,
} from '@/lib/types';
import type { MyRequest, MyInquiry, WindowAppointment } from '../MyWork';
import QueueConsole from '../QueueConsole';
import Live from '../Live';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

// PostgREST returns an embedded row as an object or a one-element array
// depending on the relationship it inferred, so every join goes through this.
const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

type ReqJoin = {
  id: string; reference: string; status: string; details: string;
  services: { name: string }[] | { name: string } | null;
};

type ApptJoin = {
  id: string; window_id: number; starts_at: string; status: string;
  student_id: string | null;
};

export default async function QueuePage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const supabase = await createClient();
  const day = today();

  // One console per office in scope. Calling a queue is inherently per-office
  // -- a window belongs to one -- so an admin viewing both gets two consoles
  // rather than one that would have to ask which office every time.
  const consoles = await Promise.all(
    ctx.departments.map(async (d: Department) => {
      const [
        { data: windows },
        { data: services },
        { data: tickets },
        { data: banner },
        { data: reqRows },
        { data: inqRows },
        { data: apptRows },
      ] = await Promise.all([
        supabase.from('service_windows').select('*')
          .eq('department', d).eq('active', true).order('id'),
        supabase.from('services').select('*')
          .eq('department', d).eq('active', true).order('id'),
        supabase.from('queue_tickets').select('*')
          .eq('department', d).eq('service_date', day).order('created_at'),
        supabase.from('queue_announcements').select('message')
          .eq('department', d).eq('active', true)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),

        // Yours, not the office's. The Requests and Inquiries tabs are the
        // whole list; these two are only what you took on in the inbox, so
        // they can be finished without leaving the window.
        supabase.from('requests')
          .select('id, reference, status, details, services(name)')
          .eq('department', d)
          .eq('assigned_to', ctx.userId)
          .not('status', 'in', '("completed","cancelled")')
          .order('created_at')
          .limit(20),
        supabase.from('inquiries')
          .select('id, reference, subject, body, name')
          .eq('department', d)
          .eq('assigned_to', ctx.userId)
          .neq('status', 'closed')
          .order('created_at')
          .limit(20),

        // Today's bookings for the whole office; the console filters them to
        // the window you are sitting at, which is a client-side choice.
        supabase.from('appointments')
          .select('id, window_id, starts_at, status, student_id, service_windows!inner(department)')
          .eq('service_windows.department', d)
          .gte('starts_at', `${day}T00:00:00`)
          .lte('starts_at', `${day}T23:59:59`)
          .order('starts_at')
          .limit(60),
      ]);

      const myRequests: MyRequest[] = ((reqRows ?? []) as ReqJoin[]).map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status as RequestStatus,
        details: r.details,
        service: one(r.services)?.name ?? 'Request',
      }));

      const myInquiries: MyInquiry[] = ((inqRows ?? []) as MyInquiry[]).map((i) => ({
        id: i.id, reference: i.reference, subject: i.subject, body: i.body, name: i.name,
      }));

      const appts = (apptRows ?? []) as ApptJoin[];
      const studentIds = [...new Set(appts.map((a) => a.student_id).filter(Boolean))];
      const { data: bookers } = studentIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : { data: [] as { id: string; full_name: string }[] };
      const bookerName = new Map(
        ((bookers ?? []) as { id: string; full_name: string }[]).map((b) => [b.id, b.full_name]),
      );

      const appointments: WindowAppointment[] = appts.map((a) => ({
        id: a.id,
        window_id: a.window_id,
        starts_at: a.starts_at,
        status: a.status,
        student: bookerName.get(a.student_id ?? '') || 'Booked appointment',
      }));

      return {
        department: d,
        windows: (windows ?? []) as ServiceWindow[],
        services: (services ?? []) as Service[],
        tickets: (tickets ?? []) as QueueTicket[],
        announcement: banner?.message ?? '',
        myRequests,
        myInquiries,
        appointments,
      };
    }),
  );

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
          <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
          <Live tables={['queue_tickets']} />
        </span>
        <h1>Queue</h1>
        <p className="lede">
          Calling completes whoever was at your window, promotes the oldest waiting
          ticket, and announces it on the lobby screen.
        </p>
      </header>

      {consoles.map((c) => (
        <section key={c.department} className="stack">
          {ctx.departments.length > 1 && (
            <h2 style={{ textTransform: 'capitalize' }}>{c.department}</h2>
          )}
          <QueueConsole
            dept={c.department}
            windows={c.windows}
            services={c.services}
            tickets={c.tickets}
            announcement={c.announcement}
            myRequests={c.myRequests}
            myInquiries={c.myInquiries}
            appointments={c.appointments}
            deptQuery={ctx.isAdmin ? `?dept=${ctx.scope}` : ''}
          />
        </section>
      ))}
    </div>
  );
}
