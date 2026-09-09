import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, type Service } from '@/lib/types';
import QuickStart from '@/components/QuickStart';
import TrackInline from '@/components/TrackInline';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let services: Service[] = [];
  let signedIn = false;

  try {
    const supabase = await createClient();
    const [{ data }, { data: auth }] = await Promise.all([
      supabase.from('services').select('*').eq('active', true).order('id'),
      supabase.auth.getUser(),
    ]);
    services = (data ?? []) as Service[];
    signedIn = Boolean(auth.user);
  } catch {
    // Before the migrations run, or if the project is asleep. The form below
    // still works -- the service can be picked on the next page instead.
  }

  return (
    <main className="wrap stack-lg">
      <header className="hero reveal" style={{ '--d': '0ms' } as React.CSSProperties}>
        <span className="eyebrow">Registrar &middot; Treasury</span>
        <h1 className="hero-title">Need a transaction?</h1>
        <p className="lede">
          Start it here. File a document request, book a time at a window, or take a
          queue number — without lining up twice.
        </p>
      </header>

      <section className="reveal" style={{ '--d': '80ms' } as React.CSSProperties}>
        <QuickStart services={services} signedIn={signedIn} />
      </section>

      <section className="stack reveal" style={{ '--d': '160ms' } as React.CSSProperties}>
        <div className="card track-card">
          <div className="stack" style={{ gap: '.4rem' }}>
            <h2>Track your transaction</h2>
            <p className="muted">
              Already filed something? Type the reference from your email or receipt and
              we will show you exactly where it is.
            </p>
          </div>
          <TrackInline />
        </div>
      </section>

      <section className="stack reveal" style={{ '--d': '240ms' } as React.CSSProperties}>
        <h2>What each office handles</h2>
        <div className="grid2">
          {DEPARTMENTS.map((d) => {
            const list = services.filter((s) => s.department === d.id);
            return (
              <div key={d.id} className="card">
                <h3>{d.name}</h3>
                <p className="muted">{d.blurb}</p>
                {list.length > 0 ? (
                  <ul className="ticklist">
                    {list.map((s) => (
                      <li key={s.id}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                             aria-hidden="true">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        {s.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: '.95rem' }}>
                    Service list unavailable right now.
                  </p>
                )}
                <Link href={`/request?dept=${d.id}`} className="btn ghost">
                  Request from the {d.name.toLowerCase()}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack reveal" style={{ '--d': '320ms' } as React.CSSProperties}>
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <span className="step-n" aria-hidden="true">1</span>
            <div>
              <strong>Tell us what you need</strong>
              <p className="muted">Pick the office and the service. Attach a photo of your ID if someone else will collect it.</p>
            </div>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">2</span>
            <div>
              <strong>We keep you posted</strong>
              <p className="muted">Every change is emailed to you and shown under Updates. No need to keep calling.</p>
            </div>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">3</span>
            <div>
              <strong>Collect it</strong>
              <p className="muted">Come in when it says Ready for pickup. Take a queue number at the door and watch the screen.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="stack reveal" style={{ '--d': '400ms' } as React.CSSProperties}>
        <h2>Good to know</h2>
        <div className="grid2">
          <div className="card">
            <h3>Office hours</h3>
            <p className="muted">
              Appointments run 8:00 AM to 5:00 PM in half-hour slots, with the lunch hour
              closed. Queue numbers reset every morning and are counted separately for
              each office.
            </p>
          </div>
          <div className="card">
            <h3>You do not have to wait in the lobby</h3>
            <p className="muted">
              Once you hold a queue number you can step away. The screen shows who is
              being served and at which window, and your position updates on your phone.
            </p>
          </div>
        </div>
      </section>

      <section className="stack reveal" style={{ '--d': '480ms' } as React.CSSProperties}>
        <h2>Not a student or employee?</h2>
        <Link href="/inquiry" className="card">
          <h3>Send a guest inquiry</h3>
          <p className="muted">
            No account needed. Ask the registrar or the treasury a question and you will
            get a reference number to follow the reply.
          </p>
        </Link>
      </section>

      <section className="stack reveal" style={{ '--d': '560ms' } as React.CSSProperties}>
        <h2>Lobby displays</h2>
        <p className="muted">
          Open one of these full-screen on the television in the lobby. It reconnects on
          its own and keeps showing the last called number if the connection drops.
        </p>
        <div className="row">
          <Link href="/display/registrar" className="btn ghost">Registrar queue screen</Link>
          <Link href="/display/treasury" className="btn ghost">Treasury queue screen</Link>
        </div>
      </section>
    </main>
  );
}
