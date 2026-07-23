/**
 * /investors/api/request-access
 * 
 * Handles the public "Request access" form submission.
 * Creates an investors row with approved=false for manual review.
 * Sends a notification email to the founder.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { sendAccessRequestNotification } from '../../lib/email';

const FOUNDER_EMAIL = import.meta.env.FOUNDER_NOTIFICATION_EMAIL || 'soggyinkgames@gmail.com';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const message = (formData.get('message') as string)?.trim();

  // Basic validation
  if (!name || !email || !email.includes('@')) {
    return redirect('/investors/request-access?error=invalid-input');
  }

  const adminSupabase = createSupabaseAdmin();

  // Check if already registered
  const { data: existing } = await adminSupabase
    .from('investors')
    .select('id, approved')
    .eq('email', email)
    .single();

  if (existing) {
    if (existing.approved) {
      // Already approved — send to login
      return redirect('/investors/login?reason=already-approved');
    } else {
      // Already submitted — show pending message
      return redirect('/investors/request-access?status=already-submitted');
    }
  }

  // Create investor record (unapproved)
  const { error: insertError } = await adminSupabase
    .from('investors')
    .insert({
      name,
      email,
      role: 'prospective',
      approved: false,
    });

  if (insertError) {
    console.error('[request-access] Insert failed:', insertError);
    return redirect('/investors/request-access?error=server-error');
  }

  // Notify founder
  try {
    await sendAccessRequestNotification({
      to: FOUNDER_EMAIL,
      applicantName: name,
      applicantEmail: email,
      message,
    });
  } catch (err) {
    // Non-fatal — the record is created, notification is best-effort
    console.error('[request-access] Notification email failed:', err);
  }

  return redirect('/investors/request-access?status=submitted');
};
