import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department, Service } from '@/lib/types';
import QueueTicket from './QueueTicket';
import GuestTicket from './GuestTicket';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function QueuePage({ searchParams }: Props) {
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
        <span className="eyebrow">Walk-in queue</span>
        <h1>Take a number</h1>
        <p className="lede" style={{ maxWidth: '38rem' }}>
          For when you are already on campus. No account needed &mdash; numbers reset
          every morning and run separately for the registrar and the treasury.
        </p>
      </header>

      <div className="page-grid">
        <div className="stack">
          {/* Signing in is worth something here -- the number follows you between
              devices and the office can notify you -- but it is not a toll gate.
              Somebody who has walked in gets a number either way. */}
          {user ? (
            <QueueTicket services={(services ?? []) as Service[]} initialDept={initialDept} />
          ) : (
            <GuestTicket services={(services ?? []) as Service[]} initialDept={initialDept} />
          )}
        </div>

        <aside className="stack">
          <div className="aside-card">
            <h3>How the queue works</h3>
            <ul className="ticklist">
              <li><Tick />One live number per office per day</li>
              <li><Tick />Registrar numbers start REG, treasury start TRE</li>
              <li><Tick />Numbering restarts each morning</li>
              <li><Tick />You are called in the order you took your number</li>
            </ul>
          </div>

          <div className="aside-card">
            <h3>You can step away</h3>
            <p className="muted small">
              Once you hold a number you do not have to stand in the lobby. This page
              shows how many people are ahead of you and updates on its own, and the
              lobby screen shows who is being served.
            </p>
            <Link className="btn ghost tiny" href="/display/registrar">Open the lobby screen</Link>
          </div>

          <div className="aside-card">
            <h3>If your number is called and you miss it</h3>
            <p className="muted small">
              Staff mark it skipped rather than cancelled. Go to any window and ask them
              to recall it &mdash; you keep the same number and go back into the line.
            </p>
          </div>

          <div className="aside-card">
            <h3>Would a set time suit you better?</h3>
            <p className="muted small">
              Book a half-hour appointment instead and skip the line entirely.
            </p>
            <Link className="btn ghost tiny" href="/appointments">Book a window</Link>
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
