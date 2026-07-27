import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const GET: APIRoute = async (context) => {
  const requestUrl = new URL(context.request.url);
  const code = requestUrl.searchParams.get('code');
  let next = requestUrl.searchParams.get('next') || '/investors/dashboard';

  // Enforce subpath prefix
  if (!next.startsWith('/investors')) {
    next = `/investors${next.startsWith('/') ? '' : '/'}${next}`;
  }

  if (code) {
    const supabase = createSupabaseServerClient(context);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Supabase auth error:', error);
      return context.redirect('https://soggyinkgames.com/investors/login?error=auth_failed', 302);
    }
  }

  // Hardcode HTTPS on primary host to fix proxy SSL protocol drop
  return context.redirect(`https://soggyinkgames.com${next}`, 302);
};


