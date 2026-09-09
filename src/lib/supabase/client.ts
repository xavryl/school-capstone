import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Uses the anon key, which is public by design -- it is
 * compiled into the JS bundle. Everything it is allowed to do is decided by
 * row level security, not by this file.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
