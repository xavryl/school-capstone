'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitInquiry } from './actions';
import { DEPARTMENTS, type Department } from '@/lib/types';

export default function InquiryForm({
  initialDept,
  initialSubject,
  initialBody,
}: {
  initialDept: Department;
  initialSubject: string;
  initialBody: string;
}) {
  const [state, action, pending] = useActionState(submitInquiry, null);

  if (state?.reference) {
    return (
      <div className="card stack">
        <span className="label">Inquiry received</span>
        <p className="mono" style={{ fontSize: '1.6rem', letterSpacing: '.04em' }}>
          {state.reference}
        </p>
        <p className="muted">
          Keep this reference. It is random rather than sequential, so nobody can guess
          another visitor&rsquo;s reference from yours. We have also sent it to the email
          address you gave.
        </p>
        <div className="row">
          <Link className="btn" href={`/track/${state.reference}`}>Track this inquiry</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card stack">
      <label className="field">
        <span className="label">Department</span>
        <select name="department" defaultValue={initialDept}>
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
        <input name="subject" defaultValue={initialSubject} placeholder="General inquiry" />
      </label>
      <label className="field">
        <span className="label">Your question</span>
        <textarea name="body" required defaultValue={initialBody} />
      </label>
      {state?.error && <p className="notice bad">{state.error}</p>}
      <div className="row">
        <button disabled={pending}>{pending ? 'Sending…' : 'Send inquiry'}</button>
      </div>
    </form>
  );
}
