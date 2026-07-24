/**
 * /investors/api/request-access
 * 
 * Handles the public "Request access" form submission.
 * Creates an auth.users record and an investors row (approved=false) for manual review.
 * Sends a notification email to the founder.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { sendAccessRequestNotification } from '../../lib/email';

const FOUNDER_EMAIL = import.meta.env.FOUNDER_NOTIFICATION_EMAIL || 'ian.araya002@gmail.com';

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

  // 1. Check if already registered in investors table
  const { data: existing } = await adminSupabase
    .from('investors')
    .select('id, approved')
    .eq('email', email)
    .maybeSingle(); // maybeSingle avoids throwing error if no row found

  if (existing) {
    if (existing.approved) {
      return redirect('/investors/login?reason=already-approved');
    } else {
      return redirect('/investors/request-access?status=already-submitted');
    }
  }

  // 2. Create the user in Supabase Auth via Admin API
  // email_confirm: true skips sending a confirmation email for now
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name }
  });

  if (authError) {
    // If the user already exists in auth.users but not in investors table, handle gracefully
    console.error('[request-access] Auth user creation failed:', authError);
    return redirect('/investors/request-access?error=server-error');
  }

  // 3. Insert investor record tied directly to the new Auth user ID
  const { error: insertError } = await adminSupabase
    .from('investors')
    .insert({
      id: authData.user.id, // 👈 FIXES NULL CONSTRAINTS
      name,
      email,
      role: 'prospective',
      approved: false,
      status: 'active'
    });

  if (insertError) {
    console.error('[request-access] Insert failed:', insertError);
    return redirect('/investors/request-access?error=server-error');
  }

  // 4. Notify founder
  try {
    await sendAccessRequestNotification({
      to: FOUNDER_EMAIL,
      applicantName: name,
      applicantEmail: email,
      message,
    });
  } catch (err) {
    console.error('[request-access] Notification email failed:', err);
  }

  return redirect('/investors/request-access?status=submitted');
};

