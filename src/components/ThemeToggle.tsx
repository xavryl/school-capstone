'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Two states rather than three. "System" is a concept that costs more to
 * explain than it saves: the page already opens in the system's theme, and
 * this button just changes it. The choice is remembered per device.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme as Theme | undefined;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private browsing. The page still switches, it just will not be
      // remembered on the next visit.
    }
  }

  // Render nothing until the effect has read the real theme, so the button
  // never claims the wrong one for a frame.
  if (!theme) return <span style={{ width: compact ? 0 : '6.5rem' }} aria-hidden="true" />;

  const goingDark = theme === 'light';

  return (
    <button
      type="button"
      className={compact ? 'nav-link' : 'theme-toggle'}
      onClick={toggle}
      aria-label={goingDark ? 'Switch to dark colours' : 'Switch to light colours'}
    >
      {goingDark ? (
        <svg key="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg key="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      )}
      {goingDark ? 'Dark' : 'Light'}
    </button>
  );
}
