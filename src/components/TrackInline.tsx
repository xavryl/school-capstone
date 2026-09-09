'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The most common reason someone comes back to this site is to ask "is it
 * ready yet?". Putting the box on the front page saves them finding Track in
 * the menu first.
 */
export default function TrackInline() {
  const router = useRouter();
  const [ref, setRef] = useState('');

  return (
    <form
      className="track-inline"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = ref.trim().toUpperCase();
        if (clean) router.push(`/track/${clean}`);
      }}
    >
      <label className="field" style={{ flex: '1 1 15rem' }}>
        <span className="label">Your reference number</span>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="REQ-9F3A2B7C1D"
          className="mono"
          aria-label="Reference number"
        />
      </label>
      <button type="submit" disabled={ref.trim().length === 0}>
        Check status
      </button>
    </form>
  );
}
