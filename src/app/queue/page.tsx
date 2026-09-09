import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Department, Service } from '@/lib/types';
import QueueTicket from './QueueTicket';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ dept?: string }> };

export default async function QueuePage({ searchParams }: Props) {
  const { dept } = await searchParams;
  const supabase = await createClient();

  const [{ data: { user } }, { data: services }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('services').select('*').order('id'),
  ]);

  if (!user) {
    return (
      <main className="wrap narrow stack-lg">
        <h1>Sign in to take a number</h1>
        <p className="lede">
          Queue numbers are tied to your account so we can notify you when your turn is
          close. Walking in without an account? The counter staff will issue you one.
        </p>
        <div className="row">
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </main>
    );
  }

  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Walk-in queue</span>
        <h1>Take a number</h1>
        <p className="lede">
          One number per department per day. Numbers reset each morning and run separately
          for the registrar and the treasury.
        </p>
      </header>

      <QueueTicket services={(services ?? []) as Service[]} initialDept={initialDept} />
    </main>
  );
}
