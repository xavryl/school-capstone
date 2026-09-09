'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/login/actions';
import { initials } from '@/lib/profile';
import ThemeToggle from './ThemeToggle';

export type NavProps = {
  email: string | null;
  unread: number;
  isStaff: boolean;
  avatarUrl: string | null;
  fullName: string | null;
};

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/request', label: 'Request' },
  { href: '/queue', label: 'Queue' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/inquiry', label: 'Guest inquiry' },
  { href: '/track', label: 'Track' },
];

export default function NavClient({ email, unread, isStaff, avatarUrl, fullName }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // A tapped link on a phone navigates without unmounting the nav, so the
  // panel would otherwise stay open over the page you just asked for.
  useEffect(() => setOpen(false), [pathname]);

  // Lift the bar off the page once it is actually overlapping content, so it
  // reads as floating rather than as part of the page header.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="One-Stop Services, home">
          <span className="brand-mark" aria-hidden="true">1‑S</span>
          <span>
            One-Stop
            <small>Registrar · Treasury</small>
          </span>
        </Link>

        {/* Three bars rather than two swapped icons, so they can rotate into
            the X instead of cutting to it. */}
        <button
          className={`hamburger${open ? ' open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ham-box" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
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

          <span className="mobile-only" style={{ marginTop: '.4rem' }}>
            <ThemeToggle />
          </span>
        </div>

        <div className="nav-right">
          <span className="desktop-only">
            <ThemeToggle />
          </span>
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
                title={`Signed in as ${fullName || email}`}
                aria-label="Your profile"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="avatar-img" />
                ) : (
                  initials(fullName, email)
                )}
              </Link>
              <form action={signOut} className="desktop-only">
                <button className="nav-signout">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn tiny">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
