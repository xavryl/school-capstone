'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { submitRequest } from './actions';
import { DEPARTMENTS, type Department, type Service } from '@/lib/types';

export default function RequestForm({
  services, initialDept, email,
}: { services: Service[]; initialDept: Department; email: string }) {
  const [dept, setDept] = useState<Department>(initialDept);
  const [state, action, pending] = useActionState(submitRequest, null);

  const visible = services.filter((s) => s.department === dept && s.active);

  if (state?.reference) {
    return (
      <div className="card stack">
        <span className="label">Request filed</span>
        <p className="mono" style={{ fontSize: '1.6rem', letterSpacing: '.04em' }}>
          {state.reference}
        </p>
        <p className="muted">
          Keep this reference. You will also see the request under your account, and we will
          email you at each status change.
        </p>
        <div className="row">
          <Link className="btn" href={`/track/${state.reference}`}>Track it</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card stack">
      <label className="field">
        <span className="label">Department</span>
        <select
          name="department"
          value={dept}
          onChange={(e) => setDept(e.target.value as Department)}
        >
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>

      <label className="field">
        <span className="label">Service</span>
        <select name="service_id" required>
          {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label className="field">
        <span className="label">Details of your request</span>
        <textarea
          name="details"
          required
          placeholder="Purpose, number of copies, name on the record, and anything the office should know."
        />
      </label>

      <label className="field">
        <span className="label">Preferred date and time (optional)</span>
        <input name="preferred_at" type="datetime-local" />
      </label>

      <div className="grid2">
        <label className="field">
          <span className="label">Contact email</span>
          <input name="email" type="email" required defaultValue={email} />
        </label>
        <label className="field">
          <span className="label">Mobile (optional)</span>
          <input name="phone" inputMode="tel" placeholder="09XX XXX XXXX" />
        </label>
      </div>

      {state?.error && <p className="notice bad">{state.error}</p>}
      <div className="row">
        <button disabled={pending}>{pending ? 'Filing...' : 'File request'}</button>
      </div>
    </form>
  );
}
