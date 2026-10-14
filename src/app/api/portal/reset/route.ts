import { customersForEmail } from '@/lib/portal/data';
import { currentHash } from '@/lib/portal/db';
import { go } from '@/lib/portal/http';
import { cleanEmail, makeLink, portalEnabled } from '@/lib/portal/session';

/**
 * First-time setup and forgotten passwords: the dealer enters their email. If it belongs to an active
 * NetSuite customer or contact, a link to set a password (valid 30 minutes, single use) is emailed.
 * The reply is the same either way, so the form never reveals which emails are registered.
 */
export async function POST(req: Request) {
  if (!portalEnabled()) return go(req, '/forgot/?formerr=1');
  const fd = await req.formData();
  if (String(fd.get('website_url') ?? '')) return go(req, '/forgot/?sent=link'); // Spam trap.
  const email = cleanEmail(fd.get('email'));
  if (!email) return go(req, '/forgot/?formerr=1');

  try {
    const ids = await customersForEmail(email);
    if (ids.length) {
      const link = new URL('/dealer/set-password/?t=' + makeLink(email, await currentHash(email)), req.url).toString();
      await sendLink(email, link);
    }
  } catch (e) {
    console.error('Dealer password link failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return go(req, '/forgot/?formerr=1');
  }
  return go(req, '/forgot/?sent=link');
}

async function sendLink(email: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Previews without email set up: the link goes to the function log (visible to your Vercel team only).
    if (process.env.VERCEL_ENV === 'production') throw new Error('RESEND_API_KEY is not set');
    console.log('[dealer set-password link, no RESEND_API_KEY set]', email, link);
    return;
  }
  const text =
    'Hi,\n\nUse this link to set your Weldclass dealer portal password. It works once, for 30 minutes.\n\n' + link +
    '\n\nIf you did not ask for this, you can ignore this email. Your current password, if you have one, stays as it is.\n\nWeldclass\n02 6764 9590';
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#151640;line-height:1.5"><p>Hi,</p><p>Use the button below to set your Weldclass dealer portal password. It works once, for 30 minutes.</p>' +
    '<p><a href="' + link + '" style="display:inline-block;background:#FD5A1B;color:#151640;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Set my password</a></p>' +
    '<p style="color:#555;font-size:13px">If you did not ask for this, you can ignore this email. Your current password, if you have one, stays as it is.</p><p>Weldclass<br>02 6764 9590</p></div>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.FORM_FROM_EMAIL || 'Weldclass Website <onboarding@resend.dev>', to: [email], subject: 'Set your Weldclass dealer portal password', text, html }),
  });
  if (!r.ok) throw new Error('Password email failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
