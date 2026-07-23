/**
 * supabase.ts
 * 
 * Server-side Supabase client factory using @supabase/ssr.
 * Creates a per-request client that reads/writes cookies correctly
 * so sessions persist through the Netlify proxy rewrite.
 */
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { Database } from '../types/database';

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not set. Auth will not work.');
}

// /**
//  * Create a Supabase server client scoped to the current Astro request.
//  * Cookies are read from and written to the Astro cookies object.
//  */
// export function createSupabaseClient(cookies: AstroCookies) {
//   return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
//     cookies: {
//       getAll() {
//         return parseCookieHeader(cookies.toString());
//       },
//       setAll(cookiesToSet) {
//         cookiesToSet.forEach(({ name, value, options }) => {
//           cookies.set(name, value, {
//             ...options,
//             // Ensure cookies work through the proxy rewrite
//             path: '/',
//             sameSite: 'lax',
//             secure: true,
//             httpOnly: true,
//           });
//         });
//       },
//     },
//   });
// }

export function createSupabaseClient(cookies: AstroCookies, request: Request) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, { ...options, path: '/', sameSite: 'lax', secure: true, httpOnly: true });
        });
      },
    },
  });
}

/**
 * Create a Supabase admin client using the service role key.
 * ONLY use server-side; never expose to the browser.
 */
export function createSupabaseAdmin() {
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!serviceKey) {
    throw new Error('[supabase] SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  // Use the same createServerClient but with service role key and no cookie handling
  return createServerClient<Database>(SUPABASE_URL, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
