/**
 * /investors/api/auth/callback
 * 
 * Handles the magic link redirect from Supabase Auth.
 * Exchanges the token for a session, logs the login event,
 * then redirects to the intended destination.
 */
import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';
import { logEvent } from '../../../lib/events';

export const GET: APIRoute = async ({ url, cookies, request, redirect }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/investors/dashboard';

  if (!code) {
    return redirect('/investors/login?error=no-code');
  }

  const supabase = createSupabaseClient(cookies, request);

  // Exchange the auth code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] Code exchange failed:', error);
    return redirect('/investors/login?error=invalid-link');
  }

  // Look up investor record
  const { data: investor } = await supabase
    .from('investors')
    .select('id, approved, role')
    .eq('email', data.session.user.email!)
    .single();

  if (investor?.approved) {
    // Log the login event
    await logEvent(supabase, investor.id, 'login', 'magic-link');
  }

  // Redirect to intended destination (or dashboard)
  const safeNext = next.startsWith('/investors/') ? next : '/investors/dashboard';
  return redirect(safeNext);
};
