/**
 * middleware/index.ts
 * 
 * Astro middleware that runs on every request to /investors/*.
 * 
 * - Public routes: / (landing) and /login — no auth required
 * - Protected routes: require valid session + approved investor
 * - Role-gated routes: /hypothesis-results and /legal require role = 'invested'
 * 
 * Also logs page_view events for authenticated investors.
 */
import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient } from '../lib/supabase';

// Routes that do NOT require authentication (normalized, no trailing slash)
const PUBLIC_ROUTES = [
  '/investors',
  '/investors/login',
  '/investors/request-access',
];

// API routes (handled separately)
const API_ROUTES_PREFIX = '/investors/api/';

// Routes that require 'invested' role (normalized, no trailing slash)
const INVESTED_ONLY_ROUTES = [
  '/investors/hypothesis-results',
  '/investors/legal',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, redirect, locals } = context;

  // Normalize trailing slash once so route lists don't need both variants
  const pathname = url.pathname.replace(/\/$/, '') || '/investors';

  // Skip middleware for API routes and static assets
  if (pathname.startsWith(API_ROUTES_PREFIX) || pathname.includes('.')) {
    return next();
  }

  // Public routes — pass through
  if (PUBLIC_ROUTES.includes(pathname)) {
    return next();
  }

  // For all other /investors/* routes, check auth.
  // Pass `request` so cookie parsing in lib/supabase.ts can read the real
  // Cookie header instead of `cookies.toString()` (which doesn't work).
  const supabase = createSupabaseClient(cookies, request);

  // Validate the session against Supabase's auth server rather than trusting
  // the cookie blindly. getSession() reads the JWT from the cookie without
  // verifying it; getUser() round-trips to Supabase to confirm it's still
  // valid. For an auth gate protecting investor documents, use getUser().
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    // Not authenticated — redirect to login
    return redirect(`/investors/login?next=${encodeURIComponent(pathname)}`);
  }

  // Look up investor record to check approval + role
  const { data: investor, error: investorError } = await supabase
    .from('investors')
    .select('id, email, name, role, approved')
    .eq('email', user.email!)
    .single();

  if (investorError || !investor) {
    // Auth user exists but no investor record — redirect to request access
    return redirect('/investors/request-access?reason=not-registered');
  }

  if (!investor.approved) {
    // Registered but not yet approved — show pending page
    return redirect('/investors/login?reason=pending');
  }

  // Check role-gated routes
  if (INVESTED_ONLY_ROUTES.includes(pathname) && investor.role !== 'invested') {
    // Under-tier — show upgrade prompt, not a hard 403
    return redirect('/investors/dashboard?reason=upgrade-required&page=' + encodeURIComponent(pathname));
  }

  // Attach investor to locals for use in pages
  locals.investor = investor;
  locals.supabase = supabase;

  // Log page_view event (fire-and-forget, don't block the response)
  supabase
    .from('events')
    .insert({
      investor_id: investor.id,
      event_type: 'page_view',
      target: pathname,
    })
    .then(() => {})
    .catch(() => {});

  return next();
});