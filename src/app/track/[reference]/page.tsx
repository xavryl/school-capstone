import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { REQUEST_PIPELINE, INQUIRY_PIPELINE, STATUS_LABEL } from '@/lib/types';

type Params = { params: Promise<{ reference: string }> };

function Pipeline({ stages, current }: { stages: string[]; current: string }) {
  const reached = stages.indexOf(current);
  return (
    <div className="row" style={{ gap: '.3rem' }}>
      {stages.map((s, i) => (
        <span key={s} className={`pill ${i < reached ? 'done' : ''} ${i === reached ? 'on' : ''}`}>
          {STATUS_LABEL[s] ?? s}
        </span>
      ))}
    </div>
  );
}

export default async function TrackResult({ params }: Params) {
  const { reference } = await params;
  const supabase = await createClient();

  // track() is SECURITY DEFINER and keyed on the random token, so a guest
  // reads exactly one record and nothing around it.
  const { data, error } = await supabase.rpc('track', { p_reference: reference });

  if (error || !data) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Nothing found</h1>
        <p className="lede">
          No request or inquiry carries the reference <span className="mono">{reference}</span>.
          Check for a typo, or the record may have been removed.
        </p>
        <div className="row"><Link className="btn ghost" href="/track">Try another</Link></div>
      </main>
    );
  }

  const rec = data as Record<string, unknown>;
  const isRequest = rec.kind === 'request';
  const timeline = (rec.timeline ?? []) as { status: string; note: string | null; at: string }[];

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">{isRequest ? 'Transaction request' : 'Guest inquiry'}</span>
        <h1 className="mono" style={{ fontSize: '1.5rem' }}>{String(rec.reference)}</h1>
        <p className="lede">
          {isRequest ? String(rec.service ?? '') : String(rec.subject ?? '')}
          {' \u00b7 '}
          <span style={{ textTransform: 'capitalize' }}>{String(rec.department)}</span>
        </p>
      </header>

      <div className="card stack">
        <span className="label">Progress</span>
        <Pipeline
          stages={isRequest ? REQUEST_PIPELINE : INQUIRY_PIPELINE}
          current={String(rec.status)}
        />
      </div>

      {isRequest && timeline.length > 0 && (
        <div className="card stack">
          <span className="label">History</span>
          <div className="stack" style={{ gap: '.55rem' }}>
            {timeline.map((e, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  <strong>{STATUS_LABEL[e.status] ?? e.status}</strong>
                  {e.note ? <span className="muted"> &mdash; {e.note}</span> : null}
                </span>
                <span className="mono muted" style={{ fontSize: '.8rem' }}>
                  {new Date(e.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isRequest && rec.response ? (
        <div className="card stack">
          <span className="label">Reply from the office</span>
          <p>{String(rec.response)}</p>
        </div>
      ) : null}
    </main>
  );
}
