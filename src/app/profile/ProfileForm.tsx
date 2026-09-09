'use client';

import { useActionState } from 'react';
import { updateProfile } from './actions';

export default function ProfileForm({
  fullName,
  studentNo,
}: {
  fullName: string;
  studentNo: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, null);

  return (
    <form action={action} className="card stack">
      <h2>Details</h2>
      <label className="field">
        <span className="label">Full name</span>
        <input name="full_name" defaultValue={fullName} required />
      </label>
      <label className="field">
        <span className="label">Student or employee number</span>
        <input
          name="student_no"
          defaultValue={studentNo}
          placeholder="2022-00123"
          className="mono"
        />
      </label>
      {state?.error && <p className="notice bad">{state.error}</p>}
      {state?.ok && <p className="notice good">Saved.</p>}
      <div className="row">
        <button disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}
