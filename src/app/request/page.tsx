import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department, Service } from '@/lib/types';
import RequestForm from './RequestForm';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function RequestPage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const supabase = await createClient();

  const [{ data: { user } }, { data: services }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('services').select('*').order('id'),
  ]);

  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Online transaction</span>
        <h1>File a request</h1>
        <p className="lede">
          Give the office what it needs up front and you will usually collect in one visit
          rather than two.
        </p>
      </header>

      {user ? (
        <RequestForm
          services={(services ?? []) as Service[]}
          initialDept={initialDept}
          email={user.email ?? ''}
          userId={user.id}
        />
      ) : (
        <div className="card stack">
          <h2>Sign in first</h2>
          <p className="muted">
            Requests are tied to your account so you can track them and pick them up.
            Not a school member? Send a guest inquiry instead.
          </p>
          <div className="row">
            <Link className="btn" href="/login">Sign in</Link>
            <Link className="btn ghost" href="/inquiry">Guest inquiry</Link>
          </div>
        </div>
      )}
    </main>
  );
}
