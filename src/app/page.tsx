import Link from 'next/link';
import { DEPARTMENTS } from '@/lib/types';

export default function Home() {
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <span className="eyebrow">Registrar &middot; Treasury</span>
        <h1>File a request without queueing twice.</h1>
        <p className="lede narrow">
          Submit your transaction online, book a window, and track it to release.
          Walk-ins and guests are handled here too.
        </p>
      </header>

      <section className="stack">
        <h2>Departments</h2>
        <div className="grid2">
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} href={`/request?dept=${d.id}`} className="card">
              <span className="label">{d.id === 'registrar' ? 'Office 01' : 'Office 02'}</span>
              <h3>{d.name}</h3>
              <p className="muted">{d.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Other ways in</h2>
        <div className="grid2">
          <Link href="/inquiry" className="card">
            <h3>I am not a student or employee</h3>
            <p className="muted">
              Send an inquiry without an account. You will get a reference number to track the reply.
            </p>
          </Link>
          <Link href="/track" className="card">
            <h3>I already have a reference</h3>
            <p className="muted">
              Check where a request or inquiry has reached, from submitted through to release.
            </p>
          </Link>
        </div>
      </section>

      <section className="stack">
        <h2>Lobby displays</h2>
        <div className="row">
          <Link href="/display/registrar" className="btn ghost">Registrar queue screen</Link>
          <Link href="/display/treasury" className="btn ghost">Treasury queue screen</Link>
        </div>
        <p className="muted" style={{ fontSize: '.9rem' }}>
          Open one of these full-screen on the television in the lobby. It reconnects on its own
          and keeps showing the last called number if the connection drops.
        </p>
      </section>
    </main>
  );
}
