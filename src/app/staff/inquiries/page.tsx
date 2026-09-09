import { createClient } from '@/lib/supabase/server';
import { getStaffGate, scopeLabel } from '@/lib/staff';
import type { InquiryStatus } from '@/lib/types';
import InquiryRow from '../InquiryRow';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string; show?: string }> };

type Record_ = {
  id: string;
  reference: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: InquiryStatus;
  response: string | null;
  created_at: string;
  department: string;
};

export default async function InquiriesPage({ searchParams }: Props) {
  const { dept, show } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const closed = show === 'closed';

  const supabase = await createClient();
  let q = supabase
    .from('inquiries')
    .select('*')
    .in('department', ctx.departments)
    .order('created_at', { ascending: false })
    .limit(60);

  q = closed ? q.eq('status', 'closed') : q.neq('status', 'closed');

  const { data } = await q;
  const rows = (data ?? []) as Record_[];

  const scopeQuery = ctx.isAdmin ? `dept=${ctx.scope}&` : '';

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
        <h1>Guest inquiries</h1>
        <p className="lede">
          Guests have no account, so a reply here is the only way they hear back — it
          also goes to the email address they gave.
        </p>
        <div className="row">
          <a className={`btn tiny${closed ? ' ghost' : ''}`} href={`/staff/inquiries?${scopeQuery}show=open`}>
            Open
          </a>
          <a className={`btn tiny${closed ? '' : ' ghost'}`} href={`/staff/inquiries?${scopeQuery}show=closed`}>
            Closed
          </a>
        </div>
      </header>

      {rows.length === 0 && (
        <p className="muted">{closed ? 'Nothing closed yet.' : 'No open inquiries.'}</p>
      )}

      {rows.map((i) => (
        <InquiryRow
          key={i.id}
          row={i}
          department={ctx.departments.length > 1 ? i.department : undefined}
        />
      ))}
    </div>
  );
}
