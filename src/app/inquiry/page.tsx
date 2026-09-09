'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitInquiry } from './actions';
import { DEPARTMENTS } from '@/lib/types';

export default function InquiryPage() {
  const [state, action, pending] = useActionState(submitInquiry, null);

  if (state?.reference) {
    return (
      <main className="wrap narrow stack-lg">
        <header className="stack">
          <span className="eyebrow">Inquiry received</span>
          <h1>Keep this reference.</h1>
        </header>
        <div className="card stack">
          <span className="label">Your reference</span>
          <p className="mono" style={{ fontSize: '1.6rem', letterSpacing: '.04em' }}>
            {state.reference}
          </p>
          <p className="muted">
            It is random rather than sequential, so nobody can guess another visitor&rsquo;s
            reference from yours. We have also sent it to the email address you gave.
          </p>
          <div className="row">
            <Link className="btn" href={`/track/${state.reference}`}>Track this inquiry</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Guests &amp; visitors</span>
        <h1>Send an inquiry</h1>
        <p className="lede">
          No account needed. You will get a reference number you can use to follow the reply.
        </p>
      </header>

      <form action={action} className="card stack">
        <label className="field">
          <span className="label">Department</span>
          <select name="department" defaultValue="registrar">
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Your name</span>
          <input name="name" required />
        </label>
        <label className="field">
          <span className="label">Email for the reply</span>
          <input name="email" type="email" required />
        </label>
        <label className="field">
          <span className="label">Subject</span>
          <input name="subject" placeholder="General inquiry" />
        </label>
        <label className="field">
          <span className="label">Your question</span>
          <textarea name="body" required />
        </label>
        {state?.error && <p className="notice bad">{state.error}</p>}
        <div className="row">
          <button disabled={pending}>{pending ? 'Sending...' : 'Send inquiry'}</button>
        </div>
      </form>
    </main>
  );
}
