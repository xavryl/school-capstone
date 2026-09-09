'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DEPARTMENTS, type Department, type Service } from '@/lib/types';

/**
 * The front page asks for the transaction itself rather than sending people
 * off to find a form. Who they are only matters at the moment they submit,
 * so the sign-in question is asked then -- not as a wall in front of the box.
 */
export default function QuickStart({
  services,
  signedIn,
}: {
  services: Service[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [dept, setDept] = useState<Department>('registrar');
  const [serviceId, setServiceId] = useState('');
  const [details, setDetails] = useState('');
  const [asking, setAsking] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const visible = services.filter((s) => s.department === dept && s.active);
  const serviceName = visible.find((s) => String(s.id) === serviceId)?.name ?? '';

  useEffect(() => {
    // Keep the service in step when the office changes, or the form would
    // carry a registrar service into a treasury request.
    setServiceId('');
  }, [dept]);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAsking(false);
    document.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [asking]);

  const requestHref =
    `/request?dept=${dept}` +
    (serviceId ? `&service=${serviceId}` : '') +
    (details.trim() ? `&details=${encodeURIComponent(details.trim().slice(0, 500))}` : '');

  const inquiryHref =
    `/inquiry?dept=${dept}` +
    (serviceName ? `&subject=${encodeURIComponent(serviceName)}` : '') +
    (details.trim() ? `&body=${encodeURIComponent(details.trim().slice(0, 500))}` : '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signedIn) router.push(requestHref);
    else setAsking(true);
  }

  return (
    <>
      <form className="card quickstart" onSubmit={submit}>
        <div className="stack" style={{ gap: '.35rem' }}>
          <h2>Start your transaction</h2>
          <p className="muted">
            Tell us what you need. We will ask who you are at the end.
          </p>
        </div>

        <div className="grid2">
          <label className="field">
            <span className="label">Which office?</span>
            <select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">What do you need?</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Choose a service…</option>
              {visible.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 && (
          <p className="notice">
            The service list has not loaded. You can still continue and pick one on the
            next page.
          </p>
        )}

        <label className="field">
          <span className="label">Anything we should know? (optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="How many copies, what it is for, the name on the record."
            maxLength={500}
            style={{ minHeight: '5.5rem' }}
          />
        </label>

        <div className="row">
          <button type="submit" className="quickstart-go">Continue</button>
          <span className="muted" style={{ fontSize: '.92rem' }}>
            Nothing is submitted yet — you can review it on the next page.
          </span>
        </div>
      </form>

      {asking && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAsking(false);
          }}
        >
          <div className="modal" ref={dialogRef} role="dialog" aria-modal="true"
               aria-label="Sign in or continue as a guest">
            <h2>Are you a student or employee?</h2>
            <p className="muted">
              School members can track a request and pick up documents. Guests get a
              reference number and an emailed reply.
            </p>

            <div className="bubble-grid">
              <Link href={`/login?next=${encodeURIComponent(requestHref)}`} className="choice">
                <span className="choice-text">
                  <strong>Yes — sign in</strong>
                  <small>I have a school account, or I can make one now.</small>
                </span>
                <svg className="choice-go" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>

              <Link href={inquiryHref} className="choice">
                <span className="choice-text">
                  <strong>No — continue as a guest</strong>
                  <small>Send it as an inquiry. No account needed.</small>
                </span>
                <svg className="choice-go" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </div>

            <button className="ghost" onClick={() => setAsking(false)}>
              Go back and edit
            </button>
          </div>
        </div>
      )}
    </>
  );
}
