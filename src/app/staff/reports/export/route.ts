import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * CSV export. Runs as the signed-in user, so row level security already
 * limits every query below to that person's own department -- there is no
 * department filter in this file because there does not need to be one.
 */
const QUERIES = {
  requests: {
    table: 'requests',
    columns: 'reference, status, details, contact_email, created_at, updated_at',
    dateColumn: 'created_at',
    deptColumn: 'department',
  },
  appointments: {
    table: 'appointments',
    columns: 'id, starts_at, ends_at, status, created_at',
    dateColumn: 'starts_at',
    deptColumn: null,
  },
  tickets: {
    table: 'queue_tickets',
    columns: 'number, state, service_date, created_at, called_at, completed_at',
    dateColumn: 'created_at',
    deptColumn: 'department',
  },
  inquiries: {
    table: 'inquiries',
    columns: 'reference, name, email, subject, status, created_at, responded_at',
    dateColumn: 'created_at',
    deptColumn: 'department',
  },
} as const;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get('type') ?? 'requests';
  const from = params.get('from');
  const to = params.get('to');

  const spec = QUERIES[type as keyof typeof QUERIES];
  if (!spec) {
    return NextResponse.json({ error: 'Unknown report type.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let query = supabase.from(spec.table).select(spec.columns);
  if (from) query = query.gte(spec.dateColumn, from);
  if (to) query = query.lte(spec.dateColumn, `${to}T23:59:59`);

  // RLS scopes an ordinary staff account to its own department already, but
  // an administrator can read both -- so an explicit filter is what keeps the
  // registrar and treasury exports separate rather than merged.
  const dept = params.get('dept');
  if (spec.deptColumn && (dept === 'registrar' || dept === 'treasury')) {
    query = query.eq(spec.deptColumn, dept);
  }

  const { data, error } = await query.order(spec.dateColumn);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv((data ?? []) as unknown as Record<string, unknown>[]);

  return new NextResponse(csv || 'No rows in this range.\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${type}-${from ?? 'all'}-to-${to ?? 'now'}.csv"`,
    },
  });
}
