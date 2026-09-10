import { createClient } from '@/lib/supabase/server';
import { getStaffGate, scopeLabel } from '@/lib/staff';
import type { Department } from '@/lib/types';
import RequestRow, { type Attachment } from '../RequestRow';
import Live from '../Live';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

type Join = {
  id: string;
  reference: string;
  status: string;
  details: string;
  created_at: string;
  department: Department;
  services: { name: string }[] | { name: string } | null;
  request_attachments: Attachment[] | null;
};

const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function RequestsPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const gate = await getStaffGate(dept);
  if (gate.state !== 'ok') return null;
  const { ctx } = gate;

  const supabase = await createClient();
  const { data } = await supabase
    .from('requests')
    .select('id, reference, status, details, created_at, department, services(name), request_attachments(path, filename)')
    .in('department', ctx.departments)
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at')
    .limit(100);

  const rows = ((data ?? []) as Join[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status as never,
    details: r.details,
    created_at: r.created_at,
    department: r.department,
    services: one(r.services),
    attachments: r.request_attachments ?? [],
  }));

  return (
    <div className="stack-lg">
      <header className="stack">
        <span className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
          <span className="eyebrow">{scopeLabel(ctx.scope)}</span>
          <Live tables={['requests']} />
        </span>
        <h1>Open requests</h1>
        <p className="lede">
          {rows.length === 0
            ? 'Nothing is waiting on you.'
            : `${rows.length} still open. Changing a status emails the student and writes to their Updates.`}
        </p>
      </header>

      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              {ctx.departments.length > 1 && <th>Office</th>}
              <th>Service &amp; documents</th>
              <th>Status</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={ctx.departments.length > 1 ? 5 : 4} className="muted">
                  No open requests.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <RequestRow
                key={r.id}
                row={r}
                showDepartment={ctx.departments.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
