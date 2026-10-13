/**
 * Form handler for the contact, batch certificate and dealer application forms.
 * Emails the submission with Resend (RESEND_API_KEY, FORM_TO_EMAIL, FORM_FROM_EMAIL) and sends the
 * visitor back to the page with ?sent= or ?formerr=. Without a key it only logs the submission.
 */
const LABELS: Record<string, string> = { contact: 'Contact enquiry', batch: 'Batch certificate request', register: 'Dealer login application', enquiry: 'Product enquiry' };
const SKIP = new Set(['form', 'back', 'website_url', 'password', 'password2']);

function back(req: Request, path: string, param: string, value: string) {
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  const u = new URL(safe, req.url);
  u.searchParams.delete('sent');
  u.searchParams.delete('formerr');
  u.searchParams.set(param, value);
  return Response.redirect(u, 303);
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const type = String(fd.get('form') ?? '');
  const backTo = String(fd.get('back') ?? '/');
  if (!LABELS[type]) return back(req, backTo, 'formerr', '1');
  if (String(fd.get('website_url') ?? '')) return back(req, backTo, 'sent', type); // Spam trap.

  const fields: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (SKIP.has(k) || typeof v !== 'string') continue;
    fields[k.replace(/[^a-z0-9_]/gi, '').toLowerCase()] = v.slice(0, 5000).trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email ?? '')) return back(req, backTo, 'formerr', '1');

  const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ');
  const title = LABELS[type] + ': ' + (name || fields.email) + (fields.business ? ' (' + fields.business + ')' : '');
  const body = Object.entries(fields).map(([k, v]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ': ' + v).join('\n');

  const key = process.env.RESEND_API_KEY;
  if (key) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FORM_FROM_EMAIL || 'Weldclass Website <onboarding@resend.dev>',
        to: (process.env.FORM_TO_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: fields.email,
        subject: '[Weldclass] ' + title,
        text: body,
      }),
    });
    if (!r.ok) {
      console.error('Form email failed', r.status, await r.text());
      return back(req, backTo, 'formerr', '1');
    }
  } else {
    console.log('[form submission, no RESEND_API_KEY set]', title + '\n' + body);
  }
  return back(req, backTo, 'sent', type);
}
