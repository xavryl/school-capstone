'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Faq = { q: string; a: string; href?: string; hrefLabel?: string; tags: string };

const FAQS: Faq[] = [
  {
    q: 'How do I request a document?',
    a: 'Sign in, open Request, pick the department and service, and describe what you need. You get a REQ reference straight away and an email at every status change.',
    href: '/request', hrefLabel: 'File a request',
    tags: 'request document certificate transcript file submit',
  },
  {
    q: 'I am not a student — can I still ask something?',
    a: 'Yes. Guest inquiry needs no account. You are given an INQ reference you can use to follow the reply, and the answer also goes to the email you provide.',
    href: '/inquiry', hrefLabel: 'Send a guest inquiry',
    tags: 'guest visitor parent outsider no account inquiry',
  },
  {
    q: 'What is the difference between a request and an inquiry?',
    a: 'A request produces a document or a transaction and runs Submitted → Pending → Processing → Ready for pickup → Completed. An inquiry is a question, and runs Submitted → Assigned → Responded → Closed.',
    tags: 'difference request inquiry status pipeline',
  },
  {
    q: 'How do queue numbers work?',
    a: 'Take one from the Queue page when you are on campus. Numbers reset every morning and run separately per office, so REG-001 and TRE-001 can both exist on the same day. You may hold one live number per office per day.',
    href: '/queue', hrefLabel: 'Take a number',
    tags: 'queue number ticket line walk-in reg tre',
  },
  {
    q: 'Do I have to wait in the lobby?',
    a: 'No. Once you hold a number you can step away — the Queue page shows how many are ahead of you, and the lobby screen shows who is being served and at which window.',
    href: '/queue', hrefLabel: 'Check your position',
    tags: 'wait lobby leave position ahead screen display',
  },
  {
    q: 'How do I book an appointment?',
    a: 'Appointments are half-hour slots between 8:00 and 5:00, lunch hour closed. A slot that greys out while you are looking has just been taken by someone else.',
    href: '/appointments', hrefLabel: 'Book a window',
    tags: 'appointment book schedule slot reserve time',
  },
  {
    q: 'What do the statuses mean?',
    a: 'Pending means it is queued for an officer. Processing means someone is working on it. Ready for pickup means the document is printed and waiting at the window. Completed means you have collected it.',
    href: '/track', hrefLabel: 'Track a reference',
    tags: 'status pending processing ready pickup completed meaning',
  },
  {
    q: 'I lost my reference number.',
    a: 'If you filed while signed in, every request is listed under your account and each status email repeats the reference. Guests who lose an INQ reference should send a new inquiry mentioning the original date and subject.',
    tags: 'lost reference forgot number recover',
  },
  {
    q: 'Can I attach documents?',
    a: 'Yes — photos or PDFs up to 10 MB each on the request form. Attach a valid ID or an authorisation letter if someone else will collect on your behalf.',
    href: '/request', hrefLabel: 'Attach on a request',
    tags: 'attach upload file document id authorisation letter pdf photo',
  },
  {
    q: 'Will I be notified?',
    a: 'Yes. Every status change writes to Updates in the top bar and sends an email. SMS is not currently enabled.',
    href: '/notifications', hrefLabel: 'See your updates',
    tags: 'notify notification email sms alert updates',
  },
];

export default function FaqBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // The lobby television is unattended; a help bubble on it is clutter.
  const hidden = pathname.startsWith('/display');

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.tags.includes(q),
    );
  }, [query]);

  if (hidden) return null;

  return (
    <>
      {open && (
        <div className="faq-panel" role="dialog" aria-label="Frequently asked questions">
          <div className="faq-head">
            <div>
              <strong>Questions?</strong>
              <div className="label">Common answers</div>
            </div>
            <button
              className="ghost tiny"
              onClick={() => setOpen(false)}
              aria-label="Close help"
            >
              Close
            </button>
          </div>

          <input
            className="faq-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — queue, appointment, reference…"
            aria-label="Search the questions"
          />

          <div className="faq-list">
            {results.length === 0 && (
              <p className="muted" style={{ fontSize: '.9rem', padding: '.5rem 0' }}>
                Nothing matches that. Try “queue”, “status”, or send a{' '}
                <Link href="/inquiry">guest inquiry</Link>.
              </p>
            )}
            {results.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
                {f.href && (
                  <Link href={f.href} className="faq-link">
                    {f.hrefLabel} →
                  </Link>
                )}
              </details>
            ))}
          </div>

          <div className="faq-foot">
            Still stuck? <Link href="/inquiry">Ask the office directly</Link>.
          </div>
        </div>
      )}

      <button
        className={`faq-fab${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close help' : 'Open help and FAQ'}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <span className="faq-fab-mark" aria-hidden="true">?</span>
        )}
      </button>
    </>
  );
}
