import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient, createSupabaseAdmin } from '../lib/supabase';

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/request-access',
];

const API_ROUTES_PREFIX = '/api/';

const INVESTED_ONLY_ROUTES = [
  '/hypothesis-results',
  '/legal',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, redirect, locals } = context;

  // 1. Cleanly normalize pathname (remove trailing slash except for standalone '/')
  let pathname = url.pathname;

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Skip middleware for API routes and static assets (images, CSS, JS, etc.)
  if (pathname.startsWith(API_ROUTES_PREFIX) || pathname.includes('.')) {
    return next();
  }

  // Pass through for public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return next();
  }

  // 2. Authenticate the JWT session with Supabase
  const supabase = createSupabaseClient(cookies, request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  // 3. Use ADMIN client to fetch investor record (Bypasses RLS initial lookup issues)
  const adminSupabase = createSupabaseAdmin();
  const { data: investor, error: investorError } = await adminSupabase
    .from('investors')
    .select('id, email, name, role, approved, status')
    .eq('id', user.id)
    .maybeSingle(); // maybeSingle won't throw PGRST116 on empty results

  if (investorError || !investor) {
    console.error('[middleware] Investor lookup failed:', investorError);
    return redirect('/request-access?reason=not-registered');
  }

  // Check if investor account is active/approved
  if (!investor.approved || investor.status !== 'active') {
    return redirect('/login?reason=pending');
  }

  // 4. Role Gate Check
  if (INVESTED_ONLY_ROUTES.includes(pathname) && investor.role !== 'invested') {
    return redirect(`/dashboard?reason=upgrade-required&page=${encodeURIComponent(pathname)}`);
  }

  // Attach locals for page rendering
  locals.investor = investor;
  locals.supabase = supabase;

  // Log page_view event asynchronously using authenticated client
  supabase
    .from('events')
    .insert({
      investor_id: investor.id,
      event_type: 'page_view',
      target: pathname,
    })
    .then(() => { })
    .catch((err) => console.error('[middleware] Event log failed:', err));

  return next();
});