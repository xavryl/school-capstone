'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/app/login/actions';
import ThemeToggle from '@/components/ThemeToggle';
import { initials } from '@/lib/profile';
import type { Scope } from '@/lib/staff';

const TABS = [
  { href: '/staff', label: 'Overview', exact: true },
  { href: '/staff/inbox', label: 'Inbox' },
  { href: '/staff/queue', label: 'Queue' },
  { href: '/staff/requests', label: 'Requests' },
  { href: '/staff/appointments', label: 'Appointments' },
  { href: '/staff/inquiries', label: 'Inquiries' },
];

const MANAGE_TABS = [{ href: '/staff/reports', label: 'Reports' }];

const ADMIN_TABS = [{ href: '/staff/people', label: 'Staff accounts' }];

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Both' },
  { id: 'registrar', label: 'Registrar' },
  { id: 'treasury', label: 'Treasury' },
];

export type SidebarProps = {
  isAdmin: boolean;
  canManage: boolean;
  roleLabel: string;
  scope: Scope;
  name: string;
  email: string;
  avatarUrl: string | null;
  unread: number;
};

/**
 * The console's own navigation. It replaces the public bar on these routes
 * rather than sitting under it: someone working a counter is in one place all
 * day, and a second row of links out to the public site was only in the way.
 * Everything that bar carried -- account, updates, theme, sign out -- moved to
 * the foot of this panel.
 */
export default function StaffSidebar({
  isAdmin,
  canManage,
  roleLabel,
  scope,
  name,
  email,
  avatarUrl,
  unread,
}: SidebarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  // On a phone the panel is a drawer. Navigating does not unmount it, so a
  // tap on any link inside closes it on the way out.
  const close = () => setOpen(false);

  // The chosen office rides along in the query string, so every tab stays in
  // the same scope and a link can be sent to someone as-is.
  const withScope = (href: string, s: Scope = scope) => {
    if (!isAdmin) return href;
    const q = new URLSearchParams(params.toString());
    q.set('dept', s);
    return `${href}?${q.toString()}`;
  };

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const tab = (href: string, label: string, exact?: boolean) => (
    <Link
      key={href}
      href={withScope(href)}
      className={`staff-tab${active(href, exact) ? ' on' : ''}`}
      aria-current={active(href, exact) ? 'page' : undefined}
    >
      {label}
    </Link>
  );

  return (
    <aside className={`console-side${open ? ' open' : ''}`}>
      <div className="console-brand">
        <Link href="/staff" className="brand" aria-label="Staff console, overview">
          <span className="brand-mark" aria-hidden="true">1‑S</span>
          <span>
            Staff console
            <small>Registrar · Treasury</small>
          </span>
        </Link>

        <button
          className={`hamburger console-burger${open ? ' open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ham-box" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div className="console-panel">
        <Link href="/profile" className="console-me" onClick={close}>
          <span className="avatar" aria-hidden="true">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="avatar-img" />
            ) : (
              initials(name, email)
            )}
          </span>
          <span className="console-me-text">
            <strong>{name || email}</strong>
            <small>{roleLabel}</small>
          </span>
        </Link>

        {isAdmin && (
          <div className="staff-scope">
            <span className="label">Viewing</span>
            <div className="scope-row">
              {SCOPES.map((s) => (
                <Link
                  key={s.id}
                  href={withScope(pathname, s.id)}
                  className={`scope-btn${scope === s.id ? ' on' : ''}`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <nav className="staff-tabs" onClick={close}>
          {TABS.map((t) => tab(t.href, t.label, t.exact))}

          {canManage && (
            <>
              <span className="staff-tab-divider">
                {isAdmin ? 'System administrator' : 'Office administrator'}
              </span>
              {MANAGE_TABS.map((t) => tab(t.href, t.label))}
              {isAdmin &&
                ADMIN_TABS.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`staff-tab${active(t.href) ? ' on' : ''}`}
                  >
                    {t.label}
                  </Link>
                ))}
            </>
          )}
        </nav>

        <div className="console-foot">
          {/* onClick on the links, not the row: toggling the theme should not
              shut the drawer you are still using. */}
          <Link
            href="/notifications"
            className={`staff-tab${active('/notifications') ? ' on' : ''}`}
            onClick={close}
          >
            Updates
            {unread > 0 && <span className="badge">{unread}</span>}
          </Link>
          <Link href="/" className="staff-tab" onClick={close}>Public site</Link>

          <div className="console-foot-row">
            <ThemeToggle />
            <form action={signOut}>
              <button className="nav-signout">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
