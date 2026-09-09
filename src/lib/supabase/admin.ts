import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. This key bypasses EVERY row level security policy.
 *
 * It is read from an unprefixed environment variable on purpose: anything
 * named NEXT_PUBLIC_* is inlined into the browser bundle by Next.js, so a
 * service key with that prefix would hand full database access to anyone who
 * opens DevTools. The `server-only` import above turns an accidental client
 * import into a build error rather than a breach.
 *
 * Used for exactly two things: broadcasting queue events, and any future
 * scheduled job that must see across all users.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Push a queue event to the television. The channel is not subscribed here --
 * supabase-js falls back to the HTTP broadcast endpoint, which is what we
 * want from a short-lived server action.
 */
export async function broadcastQueue(dept: string, payload: unknown) {
  const admin = createAdminClient();
  await admin.channel(`queue:${dept}`).send({
    type: 'broadcast',
    event: 'called',
    payload,
  });
}
