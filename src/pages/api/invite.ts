/**
 * /investors/api/invite
 * 
 * Internal API for pre-seeding investor accounts.
 * 
 * This supports the "pre-seeded invite" entry path:
 * the founder creates an investor row directly with the right role
 * and sends a direct magic-link invite — no form, no waiting.
 * 
 * SECURITY: This endpoint requires the INVITE_SECRET header.
 * It should only be called from a trusted context (e.g. a local script
 * or a secured admin page), never exposed publicly.
 * 
 * Usage:
 *   curl -X POST https://your-portal.netlify.app/investors/api/invite \
 *     -H "X-Invite-Secret: <your-secret>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"Jane Smith","email":"jane@fund.com","role":"prospective"}'
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { sendMagicLinkEmail } from '../../lib/email';
import { portalUrl } from '../../lib/paths';

export const POST: APIRoute = async ({ request }) => {
  // 1. Verify invite secret
  const inviteSecret = import.meta.env.INVITE_SECRET;
  const providedSecret = request.headers.get('X-Invite-Secret');

  if (!inviteSecret || providedSecret !== inviteSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse request body
  let body: { name: string; email: string; role?: 'prospective' | 'invested' };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, email, role = 'prospective' } = body;

  if (!name || !email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'name and email are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminSupabase = createSupabaseAdmin();

  // 3. Generate Magic Link FIRST (provisions/fetches the auth.users record)
  const { data: authData, error: authError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: portalUrl('/api/auth/callback'),
    },
  });

  if (authError || !authData.user || !authData.properties?.action_link) {
    console.error('[invite] Auth link generation failed:', authError);
    return new Response(
      JSON.stringify({ error: 'Failed to provision user auth or generate magic link' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const magicLink = authData.properties.action_link;

  // 4. Upsert investor record using the valid Auth User ID
  const { data: investor, error: upsertError } = await adminSupabase
    .from('investors')
    .upsert(
      {
        id: authData.user.id,
        name,
        email,
        role,
        approved: true,
        status: 'active',
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (upsertError || !investor) {
    console.error('[invite] Upsert failed:', upsertError);
    return new Response(JSON.stringify({ error: 'Failed to create investor record' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. Send invite email via Resend
  try {
    await sendMagicLinkEmail({ to: email, name, magicLink });
  } catch (err) {
    console.error('[invite] Email failed:', err);
    return new Response(
      JSON.stringify({
        error: 'Investor created but email failed',
        magic_link: magicLink,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 6. Return successful response
  return new Response(
    JSON.stringify({
      success: true,
      investor_id: investor.id,
      email,
      role,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
