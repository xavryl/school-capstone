import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { REQUEST_PIPELINE, STATUS_LABEL, type Department, type Service } from '@/lib/types';
import RequestForm from './RequestForm';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function RequestPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const supabase = await createClient();

  const [{ data: { user } }, { data: services }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('services').select('*').order('id'),
  ]);

  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow">Online transaction</span>
        <h1>File a request</h1>
        <p className="lede" style={{ maxWidth: '38rem' }}>
          Give the office what it needs up front and you will usually collect in one
          visit rather than two.
        </p>
      </header>

      <div className="page-grid">
        <div className="stack">
          {user ? (
            <RequestForm
              services={(services ?? []) as Service[]}
              initialDept={initialDept}
              email={user.email ?? ''}
              userId={user.id}
            />
          ) : (
            <div className="card stack">
              <h2>Sign in first</h2>
              <p className="muted">
                Requests are tied to your account so you can track them and pick them up.
                Not a school member? Send a guest inquiry instead.
              </p>
              <div className="row">
                <Link className="btn" href="/login">Sign in</Link>
                <Link className="btn ghost" href="/inquiry">Guest inquiry</Link>
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="aside-card">
            <h3>Before you start</h3>
            <ul className="ticklist">
              <li><Tick />Your student or employee number</li>
              <li><Tick />How many copies you need</li>
              <li><Tick />What it is for &mdash; board exam, transfer, employment</li>
              <li><Tick />A photo of your ID if someone else will collect it</li>
            </ul>
          </div>

          <div className="aside-card">
            <h3>What happens next</h3>
            <p className="muted small">
              You will get a REQ reference immediately, then an email at each step.
            </p>
            <div className="stages">
              {REQUEST_PIPELINE.map((s, i) => (
                <span key={s} className={`pill${i === 0 ? ' on' : ''}`}>
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          <div className="aside-card">
            <h3>Not sure yet?</h3>
            <p className="muted small">
              Ask before you file. A guest inquiry needs no account and gets an emailed
              reply with its own reference.
            </p>
            <div className="row">
              <Link className="btn ghost tiny" href="/inquiry">Ask a question</Link>
              <Link className="btn ghost tiny" href="/appointments">Book a window</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
