'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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

export default function StaffSidebar({
  isAdmin,
  canManage,
  roleLabel,
  scope,
}: {
  isAdmin: boolean;
  canManage: boolean;
  roleLabel: string;
  scope: Scope;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

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

  return (
    <aside className="staff-side">
      <div className="staff-side-head">
        <span className="label">Signed in as</span>
        <strong>{roleLabel}</strong>
      </div>

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

      <nav className="staff-tabs">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={withScope(t.href)}
            className={`staff-tab${active(t.href, t.exact) ? ' on' : ''}`}
            aria-current={active(t.href, t.exact) ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}

        {canManage && (
          <>
            <span className="staff-tab-divider">
              {isAdmin ? 'Administrator' : 'Office head'}
            </span>
            {MANAGE_TABS.map((t) => (
              <Link
                key={t.href}
                href={withScope(t.href)}
                className={`staff-tab${active(t.href) ? ' on' : ''}`}
              >
                {t.label}
              </Link>
            ))}
            {isAdmin && ADMIN_TABS.map((t) => (
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
    </aside>
  );
}
