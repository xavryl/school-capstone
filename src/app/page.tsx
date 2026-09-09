import Link from 'next/link';
import DepartmentPicker from '@/components/DepartmentPicker';
import TrackInline from '@/components/TrackInline';

export default function Home() {
  return (
    <main className="wrap stack-lg">
      <header className="hero reveal" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="hero-main">
          <span className="eyebrow">Registrar &middot; Treasury</span>
          <h1 className="hero-title">Need a transaction?</h1>
          <p className="lede">
            Tell us which office you need and we will take it from there — file it online,
            book a time, or just take a number.
          </p>
          <DepartmentPicker />
        </div>

        {/* Small and raised rather than a full-width band: most people arriving
            here already have a reference and only want the status. */}
        <aside className="track-box">
          <h2>Track your transaction</h2>
          <p className="muted small">
            Already filed something? Enter the reference from your email or receipt.
          </p>
          <TrackInline />
        </aside>
      </header>

      <section className="stack reveal" style={{ '--d': '120ms' } as React.CSSProperties}>
        <h2>Not a student or employee?</h2>
        <Link href="/inquiry" className="card">
          <h3>Send a guest inquiry</h3>
          <p className="muted">
            No account needed. Ask the registrar or the treasury a question and you will
            get a reference number to follow the reply.
          </p>
        </Link>
      </section>

      <section className="stack reveal" style={{ '--d': '210ms' } as React.CSSProperties}>
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

    </main>
  );
}
