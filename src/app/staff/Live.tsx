'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const POLL_MS = 25_000;
const SETTLE_MS = 400;

/**
 * Keeps a console page current without anybody pressing reload.
 *
 * The pages are server components, so there is nothing to patch in the
 * browser: when a row changes we ask Next to re-render the route and swap in
 * the new markup. That keeps one source of truth -- the same query that drew
 * the page draws the update -- instead of a second, client-side copy of every
 * list that could drift from it.
 *
 * Realtime applies the same row level security a query does, so a registrar
 * administrator is woken by registrar rows and never learns that a treasury
 * row moved. No department filter is needed here, and one would be wrong for
 * the system administrator watching both.
 *
 * A poll runs underneath at a deliberately slow interval. If the socket never
 * connects -- the tables are not published yet, a proxy eats websockets -- the
 * page is stale by a matter of seconds rather than indefinitely.
 */
export default function Live({
  tables,
  label = 'Live',
}: {
  tables: string[];
  label?: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Several rows often change in one action -- calling next completes one
    // ticket and promotes another. Coalesce them into a single refresh.
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), SETTLE_MS);
    };

    const channel = supabase.channel(`console:${tables.join('-')}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, bump);
    }
    channel.subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    const poll = setInterval(() => router.refresh(), POLL_MS);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // tables is a literal array at every call site; join it so a new array
    // with the same contents does not tear the subscription down.
  }, [router, tables.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`live${connected ? ' on' : ''}`} title={
      connected
        ? 'Updating as the offices work. No need to reload.'
        : 'Checking for changes every few seconds.'
    }>
      <span className="live-dot" aria-hidden="true" />
      {connected ? label : 'Checking'}
    </span>
  );
}
