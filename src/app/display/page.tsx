import Link from 'next/link';
import { DEPARTMENTS } from '@/lib/types';

export const metadata = { title: 'Lobby screen' };

export default function DisplayChooser() {
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow">Lobby screen</span>
        <h1>Queue display</h1>
        <p className="lede" style={{ maxWidth: '38rem' }}>
          The same screen as the television in the lobby: who is being served, at which
          window, and who is next. Watch it from here if you have stepped out.
        </p>
      </header>

      <div className="page-grid">
        <section className="stack">
          <h2>Choose an office</h2>
          <div className="grid2">
            {DEPARTMENTS.map((d) => (
              <Link key={d.id} href={`/display/${d.id}`} className="card">
                <h3>{d.name}</h3>
                <p className="muted">
                  Numbers beginning{' '}
                  <span className="mono">{d.id === 'registrar' ? 'REG' : 'TRE'}</span>
                  {' · '}{d.blurb.toLowerCase()}
                </p>
                <span className="btn ghost">Open the screen</span>
              </Link>
            ))}
          </div>

          <p className="muted small">
            Watching from your phone instead? These pages work at any size — the layout
            stacks and the type stays readable.
          </p>
        </section>

        <aside className="stack">
          <div className="aside-card">
            <h3>What you will see</h3>
            <ul className="ticklist">
              <li><Tick />The number being served right now</li>
              <li><Tick />Which window to go to</li>
              <li><Tick />The next few numbers in line</li>
              <li><Tick />Notices from the office, such as an early closing</li>
            </ul>
          </div>

          <div className="aside-card">
            <h3>It keeps itself up to date</h3>
            <p className="muted small">
              The screen changes the moment staff call a number, and checks again every
              few seconds on its own. If the connection drops it holds the last number
              rather than going blank &mdash; a dot at the bottom tells you whether it is
              live.
            </p>
          </div>

          <div className="aside-card">
            <h3>Waiting for your turn?</h3>
            <p className="muted small">
              Your own page shows how many people are ahead of you, so you do not have to
              watch the screen at all.
            </p>
            <Link className="btn ghost tiny" href="/queue">Check your position</Link>
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
