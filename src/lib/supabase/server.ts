import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server client, bound to the caller's session cookies. Use this in Server
 * Components and Server Actions so RLS still applies as the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
