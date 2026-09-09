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
function serviceKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Placeholder from .env.local counts as absent.
  return key && !key.startsWith('paste-your') ? key : null;
}

export function createAdminClient() {
  const key = serviceKey();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Push a queue event to the television. The channel is not subscribed here --
 * supabase-js falls back to the HTTP broadcast endpoint, which is what we
 * want from a short-lived server action.
 *
 * Degrades rather than throws when the service key is absent. Losing the
 * broadcast costs the display its instant update, not its correctness: it
 * polls current_queue_state every ten seconds regardless, so the screen is
 * at worst ten seconds stale. Failing the whole "Call next" action over a
 * missing notification key would be the worse trade.
 */
export async function broadcastQueue(dept: string, payload: unknown) {
  if (!serviceKey()) {
    console.info(
      `[broadcast skipped: no SUPABASE_SERVICE_ROLE_KEY] queue:${dept} — ` +
      'the display will pick this up on its next poll.',
    );
    return;
  }

  try {
    const admin = createAdminClient();
    await admin.channel(`queue:${dept}`).send({
      type: 'broadcast',
      event: 'called',
      payload,
    });
  } catch (err) {
    console.error('[broadcast failed]', err);
  }
}
