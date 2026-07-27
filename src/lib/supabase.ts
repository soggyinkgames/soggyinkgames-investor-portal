/**
 * supabase.ts
 * 
 * Server-side Supabase client factory using @supabase/ssr.
 * Creates a per-request client that reads/writes cookies correctly
 * so sessions persist through the Netlify proxy rewrite.
 */
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { APIContext, AstroCookies } from 'astro';
import type { Database } from '../types/database';

const SUPABASE_URL = (import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL) as string;
const SUPABASE_ANON_KEY = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY) as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not set. Auth will not work.');
}

export function createSupabaseClient(cookies: AstroCookies, request: Request) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: true,
            httpOnly: true,
          });
        });
      },
    },
  });
}

export const createSupabaseServerClient = (context: APIContext) => {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: true,
          });
        });
      },
    },
  });
};

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
