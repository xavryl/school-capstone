'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Department } from '@/lib/types';

const OFFICES: {
  id: Department;
  name: string;
  blurb: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'registrar',
    name: 'Registrar',
    blurb: 'Certificates, transcripts, enrolment records',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M15 2v5h5M9 12h7M9 16h7" />
      </svg>
    ),
  },
  {
    id: 'treasury',
    name: 'Treasury',
    blurb: 'Payments, assessments, official receipts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="M2.5 10h19M6 15h4" />
      </svg>
    ),
  },
];

const ACTIONS = [
  {
    href: (d: Department) => `/request?dept=${d}`,
    title: 'Request a document',
    blurb: 'File it online and pick it up when it is ready.',
  },
  {
    href: (d: Department) => `/appointments?dept=${d}`,
    title: 'Book a time',
    blurb: 'Reserve a half-hour slot at a window.',
  },
  {
    href: (d: Department) => `/queue?dept=${d}`,
    title: 'Take a queue number',
    blurb: 'You are already on campus and want to be seen today.',
  },
];

export default function DepartmentPicker() {
  const [open, setOpen] = useState(false);
  const [office, setOffice] = useState<Department | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, and send focus into the bubble so a
  // keyboard or screen-reader user is not left behind on the button.
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setOffice(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, office]);

  const chosen = OFFICES.find((o) => o.id === office);

  return (
    <div className="picker" ref={wrapRef}>
      <button
        className="picker-cta"
        onClick={() => {
          setOpen((v) => !v);
          setOffice(null);
        }}
        aria-expanded={open}
      >
        {open ? 'Close' : 'Start here'}
        <svg
          className={`picker-chev${open ? ' up' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="bubble" ref={panelRef} role="dialog" aria-label="Choose an office">
          {!chosen ? (
            <div className="bubble-step" key="offices">
              <p className="bubble-q">Which office do you need?</p>
              <div className="bubble-grid">
                {OFFICES.map((o) => (
                  <button
                    key={o.id}
                    className="choice"
                    onClick={() => setOffice(o.id)}
                  >
                    <span className="choice-icon">{o.icon}</span>
                    <span className="choice-text">
                      <strong>{o.name}</strong>
                      <small>{o.blurb}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="bubble-foot">
                Not a student or employee?{' '}
                <Link prefetch={false} href="/inquiry">Send a guest inquiry</Link>
              </p>
            </div>
          ) : (
            <div className="bubble-step" key={chosen.id}>
              <button className="bubble-back" onClick={() => setOffice(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                All offices
              </button>
              <p className="bubble-q">What do you need from the {chosen.name.toLowerCase()}?</p>
              <div className="bubble-grid">
                {ACTIONS.map((a) => (
                  <Link key={a.title} prefetch={false} href={a.href(chosen.id)} className="choice">
                    <span className="choice-text">
                      <strong>{a.title}</strong>
                      <small>{a.blurb}</small>
                    </span>
                    <svg className="choice-go" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                         strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
