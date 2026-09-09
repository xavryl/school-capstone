import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { markAllRead } from './actions';

export const dynamic = 'force-dynamic';

type Notification = {
  id: number;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Sign in to see updates</h1>
        <div className="row">
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </main>
    );
  }

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Notification[];
  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Updates</span>
        <h1>Notifications</h1>
        <p className="lede">
          Every status change on your requests and appointments lands here, and is
          emailed to you as well.
        </p>
      </header>

      {unread > 0 && (
        <form action={markAllRead}>
          <button className="ghost">Mark all {unread} as read</button>
        </form>
      )}

      <div className="stack">
        {rows.length === 0 && <p className="muted">Nothing yet.</p>}
        {rows.map((n) => {
          const inner = (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{n.title}</strong>
                {!n.read_at && <span className="pill warn">New</span>}
              </div>
              {n.body && <p className="muted">{n.body}</p>}
              <span className="label">{new Date(n.created_at).toLocaleString()}</span>
            </>
          );
          return n.href ? (
            <Link key={n.id} href={n.href} className="card">{inner}</Link>
          ) : (
            <div key={n.id} className="card">{inner}</div>
          );
        })}
      </div>
    </main>
  );
}
