/**
 * /investors/api/auth/callback
 * 
 * Handles the magic link redirect from Supabase Auth.
 * Exchanges the token for a session, logs the login event,
 * then redirects to the intended destination.
 */
import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdmin } from '../../../lib/supabase';
import { logEvent } from '../../../lib/events';

export const GET: APIRoute = async ({ url, cookies, request, redirect }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/investors/dashboard';

  if (!code) {
    return redirect('/investors/login?error=no-code');
  }

  const supabase = createSupabaseClient(cookies, request);

  // 1. Exchange the auth code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] Code exchange failed:', error);
    return redirect('/investors/login?error=invalid-link');
  }

  const user = data.session.user;
  const adminSupabase = createSupabaseAdmin();

  // 2. Fetch investor record via Admin client (bypasses RLS) by ID or Email
  let { data: investor } = await adminSupabase
    .from('investors')
    .select('id, approved, role, email')
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  if (!investor) {
    console.error('[auth/callback] No investor record found for user:', user.email);
    return redirect('/investors/request-access?reason=not-registered');
  }

  // 3. Ensure investors.id matches the auth.users.id
  if (investor.id !== user.id) {
    const { error: updateError } = await adminSupabase
      .from('investors')
      .update({ id: user.id })
      .eq('email', user.email!);

    if (updateError) {
      console.error('[auth/callback] Failed to sync investor ID with Auth ID:', updateError);
    } else {
      investor.id = user.id; // Update in-memory reference
    }
  }

  // 4. Log the login event
  if (investor.approved) {
    await logEvent(supabase, investor.id, 'login', 'magic-link').catch(() => {});
  }

  // 5. Safe Redirect
  const safeNext = next.startsWith('/investors/') ? next : '/investors/dashboard';
  return redirect(safeNext);
};


