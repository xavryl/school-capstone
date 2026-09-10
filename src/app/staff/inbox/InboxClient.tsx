'use client';

import { useMemo, useState, useTransition } from 'react';
import { claim, assign, markCatered } from './actions';

export type Ticket = {
  kind: 'request' | 'inquiry';
  id: string;
  reference: string;
  title: string;
  detail: string;
  status: string;
  state: 'open' | 'catering' | 'catered';
  department: string;
  assigned_to: string | null;
  assigned_name: string;
  from_name: string;
  from_email: string;
  created_at: string;
};

export type Colleague = { id: string; name: string };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Nobody on it' },
  { id: 'mine', label: 'On me' },
  { id: 'catering', label: 'Being catered' },
  { id: 'catered', label: 'Catered' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

const STATE_WORD: Record<Ticket['state'], string> = {
  open: 'Nobody catering',
  catering: 'Already catering',
  catered: 'Already catered',
};

function when(iso: string) {
  const d = new Date(iso);
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 60) return `${Math.max(1, Math.floor(mins))} min ago`;
  if (mins < 60 * 24) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/**
 * The inbox reads like a mail client because that is the job: a list you scan
 * down, and one message open beside it. The dot on every row is the whole
 * point -- green nobody has it, yellow somebody is on it, red it is finished
 * -- so two windows never cater the same person twice.
 */
export default function InboxClient({
  tickets,
  colleagues,
  canManage,
  showDepartment,
  meId,
}: {
  tickets: Ticket[];
  colleagues: Colleague[];
  canManage: boolean;
  showDepartment: boolean;
  meId: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(tickets[0] ? key(tickets[0]) : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(
    () =>
      tickets.filter((t) => {
        if (filter === 'all') return true;
        if (filter === 'mine') return t.assigned_to === meId && t.state !== 'catered';
        return t.state === filter;
      }),
    [tickets, filter, meId],
  );

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => t.state === 'open').length,
      mine: tickets.filter((t) => t.assigned_to === meId && t.state !== 'catered').length,
      catering: tickets.filter((t) => t.state === 'catering').length,
      catered: tickets.filter((t) => t.state === 'catered').length,
    }),
    [tickets, meId],
  );

  const open = shown.find((t) => key(t) === openId) ?? shown[0] ?? null;

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r.error) setMsg(r.error);
    });

  return (
    <div className="stack">
      <div className="mailbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`mailfilter${filter === f.id ? ' on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="mailcount">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {msg && <p className="notice bad">{msg}</p>}

      <div className="mail">
        <ol className="maillist">
          {shown.length === 0 && (
            <li className="mailempty muted">Nothing here. Try another filter.</li>
          )}

          {shown.map((t) => (
            <li key={key(t)}>
              <button
                className={`mailrow${key(t) === (open && key(open)) ? ' on' : ''}${
                  t.state === 'catered' ? ' done' : ''
                }`}
                onClick={() => setOpenId(key(t))}
              >
                <span className={`dot ${t.state}`} title={STATE_WORD[t.state]} />
                <span className="mailavatar" aria-hidden="true">{initials(t.from_name)}</span>
                <span className="mailtext">
                  <span className="mailtop">
                    <strong className="mailfrom">{t.from_name}</strong>
                    <span className="mailwhen">{when(t.created_at)}</span>
                  </span>
                  <span className="mailsub">
                    <span className={`tag ${t.kind}`}>
                      {t.kind === 'request' ? 'Request' : 'Inquiry'}
                    </span>
                    {showDepartment && <span className="tag">{t.department}</span>}
                    {t.title}
                  </span>
                  <span className="mailsnip">{t.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mailread">
          {!open ? (
            <p className="muted">Pick a concern on the left to read it.</p>
          ) : (
            <article className="stack">
              <div className="row" style={{ gap: '.45rem', alignItems: 'center' }}>
                <span className={`dot ${open.state}`} />
                <span className="mono ticket-ref">{open.reference}</span>
                <span className={`tag ${open.kind}`}>
                  {open.kind === 'request' ? 'Request' : 'Inquiry'}
                </span>
                {showDepartment && <span className="tag">{open.department}</span>}
                <span className="spacer" />
                <span className="muted" style={{ fontSize: '.88rem' }}>
                  {new Date(open.created_at).toLocaleString()}
                </span>
              </div>

              <h3 style={{ margin: 0 }}>{open.title}</h3>

              <div className="mailmeta">
                <span className="mailavatar big" aria-hidden="true">
                  {initials(open.from_name)}
                </span>
                <span>
                  <strong>{open.from_name}</strong>
                  {open.from_email && (
                    <div className="muted" style={{ fontSize: '.9rem' }}>{open.from_email}</div>
                  )}
                </span>
              </div>

              <p className="mailbody">{open.detail}</p>

              <p className={`statusline ${open.state}`}>
                {open.state === 'open' && 'Nobody is catering this yet.'}
                {open.state === 'catering' &&
                  (open.assigned_to === meId
                    ? 'You are catering this.'
                    : `${open.assigned_name || 'A colleague'} is already catering this.`)}
                {open.state === 'catered' && `Already catered — marked ${open.status}.`}
              </p>

              <div className="row">
                {open.state === 'open' && (
                  <button disabled={pending} onClick={() => act(() => claim(open.kind, open.id))}>
                    {pending ? 'Taking…' : 'Cater this'}
                  </button>
                )}

                {open.state === 'catering' && open.assigned_to === meId && (
                  <>
                    <button
                      disabled={pending}
                      onClick={() => act(() => markCatered(open.kind, open.id))}
                    >
                      {pending ? 'Saving…' : 'Mark as catered'}
                    </button>
                    <button
                      className="ghost"
                      disabled={pending}
                      onClick={() => act(() => assign(open.kind, open.id, null))}
                    >
                      Put back
                    </button>
                  </>
                )}

                {open.state === 'catering' && open.assigned_to !== meId && !canManage && (
                  <button disabled>Someone else has this</button>
                )}

                {canManage && open.state !== 'catered' && colleagues.length > 0 && (
                  <select
                    value=""
                    disabled={pending}
                    style={{ maxWidth: '13rem' }}
                    onChange={(e) => {
                      const to = e.target.value;
                      if (to) act(() => assign(open.kind, open.id, to));
                    }}
                  >
                    <option value="">Hand to…</option>
                    {colleagues.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

const key = (t: Ticket) => `${t.kind}-${t.id}`;
