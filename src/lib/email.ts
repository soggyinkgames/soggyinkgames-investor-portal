/**
 * email.ts
 * 
 * Transactional email via Resend.
 * Wired instead of Supabase's default sender for reliable magic-link delivery.
 * 
 * To configure:
 *   1. Create a Resend account at https://resend.com
 *   2. Add your domain and verify DNS records
 *   3. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env
 */
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export interface MagicLinkEmailOptions {
  to: string;
  name?: string;
  magicLink: string;
}

export async function sendMagicLinkEmail({ to, name, magicLink }: MagicLinkEmailOptions) {
  const displayName = name || to;

  const { data, error } = await resend.emails.send({
    from: `Soggy Ink Games Investors <${FROM_EMAIL}>`,
    to: [to],
    subject: 'Your Soggy Ink Games investor portal login link',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investor Portal Login</title>
</head>
<body style="margin:0;padding:0;background:#0f1623;font-family:Inter,sans-serif;color:#e8edf5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#162032;border:1px solid #1e2d42;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Top accent bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#8d52fb,#ff66c4,#00acd2);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <img src="https://res.cloudinary.com/soggy-ink-games/image/upload/v1651059402/soggyInkGamesSMALL_axleob.png"
                   alt="Soggy Ink Games" width="40" height="40" style="display:block;margin-bottom:16px;opacity:0.9;" />
              <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8fa3bf;font-family:sans-serif;">
                SOGGY INK GAMES · INVESTOR PORTAL
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#e8edf5;letter-spacing:0.05em;">
                Your login link
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#8fa3bf;">
                Hi ${displayName},<br><br>
                Click the button below to sign in to the Soggy Ink Games investor portal.
                This link expires in <strong style="color:#e8edf5;">1 hour</strong> and can only be used once.
              </p>
              <a href="${magicLink}"
                 style="display:inline-block;padding:14px 28px;background:#00acd2;color:#0f1623;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;letter-spacing:0.03em;">
                Sign in to investor portal →
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#4d6480;line-height:1.5;">
                If you didn't request this link, you can safely ignore this email.<br>
                This link is personal — do not share it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e2d42;">
              <p style="margin:0;font-size:11px;color:#4d6480;">
                © ${new Date().getFullYear()} Soggy Ink Games Pty Ltd · This email is confidential.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `Hi ${displayName},\n\nClick the link below to sign in to the Soggy Ink Games investor portal:\n\n${magicLink}\n\nThis link expires in 1 hour and can only be used once.\n\nIf you didn't request this, ignore this email.\n\n© ${new Date().getFullYear()} Soggy Ink Games Pty Ltd`,
  });

  if (error) {
    console.error('[email] Failed to send magic link:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  return data;
}

export interface AccessRequestEmailOptions {
  to: string;
  applicantName: string;
  applicantEmail: string;
  message?: string;
}

export async function sendAccessRequestNotification({ to, applicantName, applicantEmail, message }: AccessRequestEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: `Soggy Ink Games Portal <${FROM_EMAIL}>`,
    to: [to],
    subject: `New investor access request: ${applicantName}`,
    html: `
<html><body style="font-family:Inter,sans-serif;color:#333;padding:24px;">
  <h2>New Investor Access Request</h2>
  <p><strong>Name:</strong> ${applicantName}</p>
  <p><strong>Email:</strong> ${applicantEmail}</p>
  ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
  <p>Review and approve in your <a href="https://supabase.com/dashboard">Supabase dashboard</a> or investor admin panel.</p>
</body></html>
    `,
    text: `New investor access request\nName: ${applicantName}\nEmail: ${applicantEmail}${message ? `\nMessage: ${message}` : ''}\n\nReview in Supabase dashboard.`,
  });

  if (error) {
    console.error('[email] Failed to send access request notification:', error);
  }

  return data;
}
