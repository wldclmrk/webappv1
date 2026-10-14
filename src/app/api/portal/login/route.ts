import { customersForEmail } from '@/lib/portal/data';
import { go } from '@/lib/portal/http';
import { cleanEmail, makeLink, portalEnabled } from '@/lib/portal/session';

/**
 * Dealer sign-in, step 1: the dealer enters their email. If it belongs to an active NetSuite
 * customer or contact, a sign-in link valid for 15 minutes is emailed with Resend.
 * The reply is the same either way, so the form never reveals which emails are registered.
 */
export async function POST(req: Request) {
  if (!portalEnabled()) return go(req, '/login/?formerr=1');
  const fd = await req.formData();
  if (String(fd.get('website_url') ?? '')) return go(req, '/login/?sent=link'); // Spam trap.
  const email = cleanEmail(fd.get('email'));
  if (!email) return go(req, '/login/?formerr=1');

  try {
    const ids = await customersForEmail(email);
    if (ids.length) {
      const link = new URL('/api/portal/verify/?t=' + makeLink(email), req.url).toString();
      await sendLink(email, link);
    }
  } catch (e) {
    console.error('Dealer sign-in failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return go(req, '/login/?formerr=1');
  }
  return go(req, '/login/?sent=link');
}

async function sendLink(email: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Previews without email set up: the link goes to the function log (visible to your Vercel team only).
    if (process.env.VERCEL_ENV === 'production') throw new Error('RESEND_API_KEY is not set');
    console.log('[dealer sign-in link, no RESEND_API_KEY set]', email, link);
    return;
  }
  const text =
    'Hi,\n\nUse this link to sign in to the Weldclass dealer portal. It works for 15 minutes.\n\n' + link +
    '\n\nIf you did not ask to sign in, you can ignore this email.\n\nWeldclass\n02 6764 9590';
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#151640;line-height:1.5"><p>Hi,</p><p>Use the button below to sign in to the Weldclass dealer portal. It works for 15 minutes.</p>' +
    '<p><a href="' + link + '" style="display:inline-block;background:#FD5A1B;color:#151640;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Sign in to the dealer portal</a></p>' +
    '<p style="color:#555;font-size:13px">If you did not ask to sign in, you can ignore this email.</p><p>Weldclass<br>02 6764 9590</p></div>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.FORM_FROM_EMAIL || 'Weldclass Website <onboarding@resend.dev>', to: [email], subject: 'Your Weldclass dealer portal sign-in link', text, html }),
  });
  if (!r.ok) throw new Error('Sign-in email failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
