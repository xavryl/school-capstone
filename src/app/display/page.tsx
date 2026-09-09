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
          The screen for the television in the lobby. It shows who is being served, at
          which window, and who is next. No sign-in needed — open it and leave it running.
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
            <h3>Setting up the television</h3>
            <ol className="numlist">
              <li>Open the office&rsquo;s screen in a browser on the TV or the computer driving it.</li>
              <li>Press <kbd>F11</kbd> for full screen.</li>
              <li>Turn the volume up if you want numbers announced aloud.</li>
              <li>Leave it. It does not need anyone signed in.</li>
            </ol>
          </div>

          <div className="aside-card">
            <h3>It looks after itself</h3>
            <ul className="ticklist">
              <li><Tick />Updates the moment staff call a number</li>
              <li><Tick />Re-checks every ten seconds in case the connection drops silently</li>
              <li><Tick />Keeps showing the last called number if the internet goes down</li>
              <li><Tick />A dot at the bottom shows live, reconnecting, or offline</li>
            </ul>
          </div>

          <div className="aside-card">
            <h3>Announcements</h3>
            <p className="muted small">
              Staff can post a notice to the screen from the console — closing early,
              a window shut for lunch. It appears under the numbers until they clear it.
            </p>
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
