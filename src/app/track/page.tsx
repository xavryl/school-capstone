'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TrackEntry() {
  const router = useRouter();
  const [ref, setRef] = useState('');

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Tracking</span>
        <h1>Where is my transaction?</h1>
        <p className="lede">
          Enter the reference from your request or inquiry. Requests start with REQ, inquiries with INQ.
        </p>
      </header>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (ref.trim()) router.push(`/track/${ref.trim().toUpperCase()}`);
        }}
      >
        <label className="field">
          <span className="label">Reference</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="REQ-9F3A2B7C1D"
            className="mono"
            required
          />
        </label>
        <div className="row"><button>Track</button></div>
      </form>
    </main>
  );
}
