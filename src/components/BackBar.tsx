'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/display': 'Lobby screen',
  '/request': 'File a request',
  '/queue': 'Queue number',
  '/appointments': 'Appointments',
  '/inquiry': 'Guest inquiry',
  '/track': 'Track a transaction',
  '/profile': 'Your profile',
  '/notifications': 'Updates',
  '/login': 'Sign in',
  '/reset-password': 'New password',
  '/staff': 'Staff console',
  '/staff/queue': 'Queue',
  '/staff/requests': 'Requests',
  '/staff/appointments': 'Appointments',
  '/staff/inquiries': 'Inquiries',
  '/staff/reports': 'Reports',
  '/staff/people': 'Staff accounts',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : '';
}

export default function BackBar() {
  const pathname = usePathname();
  const router = useRouter();

  // The home page has nowhere to go back to, and the television screens
  // themselves carry no navigation. The /display chooser is an ordinary page
  // and keeps its bar.
  if (pathname === '/' || pathname.startsWith('/display/')) return null;

  return (
    <div className="backbar">
      <div className="backbar-inner">
        <button
          className="back-btn"
          onClick={() => {
            // Landing here directly — from an emailed link, or a typed URL —
            // means there is no history to step back through.
            if (window.history.length > 1) router.back();
            else router.push('/');
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <span className="backbar-title">{titleFor(pathname)}</span>

        <Link href="/" className="home-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
          Home
        </Link>
      </div>
    </div>
  );
}
