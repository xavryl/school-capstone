'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/login/actions';

export type NavProps = {
  email: string | null;
  unread: number;
  isStaff: boolean;
};

const PUBLIC_LINKS = [
  { href: '/request', label: 'Request' },
  { href: '/queue', label: 'Queue' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/inquiry', label: 'Guest inquiry' },
  { href: '/track', label: 'Track' },
];

export default function NavClient({ email, unread, isStaff }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A tapped link on a phone navigates without unmounting the nav, so the
  // panel would otherwise stay open over the page you just asked for.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="One-Stop Services, home">
          <span className="brand-mark" aria-hidden="true">1‑S</span>
          <span>
            One-Stop
            <small>Registrar · Treasury</small>
          </span>
        </Link>

        <button
          className="hamburger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" aria-hidden="true">
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>

        <div className={`nav-links${open ? ' open' : ''}`} id="nav-links">
          {PUBLIC_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${isActive(l.href) ? ' active' : ''}`}
              aria-current={isActive(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}

          {isStaff && (
            <Link
              href="/staff"
              className={`nav-link staff${isActive('/staff') ? ' active' : ''}`}
              aria-current={isActive('/staff') ? 'page' : undefined}
            >
              Staff console
            </Link>
          )}

          {/* Duplicated inside the panel because the right-hand cluster is
              off-screen on a phone. */}
          {email && (
            <Link
              href="/notifications"
              className={`nav-link mobile-only${isActive('/notifications') ? ' active' : ''}`}
            >
              Updates{unread > 0 ? ` (${unread})` : ''}
            </Link>
          )}
          {email && (
            <Link
              href="/profile"
              className={`nav-link mobile-only${isActive('/profile') ? ' active' : ''}`}
            >
              Profile
            </Link>
          )}
        </div>

        <div className="nav-right">
          {email ? (
            <>
              <Link
                href="/notifications"
                className={`nav-link desktop-only${isActive('/notifications') ? ' active' : ''}`}
                title="Notifications"
              >
                Updates
                {unread > 0 && <span className="badge">{unread}</span>}
              </Link>
              <Link
                href="/profile"
                className="avatar"
                title={`Signed in as ${email}`}
                aria-label="Your profile"
              >
                {email.slice(0, 1)}
              </Link>
              <form action={signOut} className="desktop-only">
                <button className="nav-signout">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn" style={{ padding: '.38rem .8rem' }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
