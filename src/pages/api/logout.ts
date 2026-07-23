/**
 * /investors/api/logout
 * 
 * POST handler — signs out the current investor and redirects to login.
 */
import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../lib/supabase';

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createSupabaseClient(cookies, request);
  await supabase.auth.signOut();
  return redirect('/investors/login');
};
