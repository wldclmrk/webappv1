import { account, salesRep } from '@/lib/portal/dashboard';
import { go } from '@/lib/portal/http';
import { sessionFromRequest } from '@/lib/portal/session';

/**
 * Dealer requests from the portal (reorder a previous order, or ask for a call back).
 * Emails the customer's account manager and the sales inbox (FORM_TO_EMAIL) with Resend.
 * Online ordering will replace the reorder request in the next stage.
 */
const KINDS: Record<string, string> = { reorder: 'Reorder request', call: 'Call back request' };

export async function POST(req: Request) {
  const s = sessionFromRequest(req);
  if (!s) return go(req, '/login/?expired=1');
  const fd = await req.formData();
  const kind = String(fd.get('kind') ?? '');
  if (!KINDS[kind]) return go(req, '/dealer/?reqerr=1');
  const ref = String(fd.get('ref') ?? '').replace(/[^\w\-/ ]/g, '').slice(0, 40);

  try {
    const a = await account(s.cur);
    let rep: Awaited<ReturnType<typeof salesRep>> = null;
    try {
      rep = await salesRep(a.salesRep);
    } catch {
      // Still send to the sales inbox.
    }
    const subject = '[Distributor portal] ' + KINDS[kind] + ': ' + a.name + ' (' + a.number + ')' + (ref ? ' ' + ref : '');
    const text = [
      KINDS[kind] + ' from the distributor portal.',
      '',
      'Customer: ' + a.name,
      'Account: ' + a.number,
      'Requested by: ' + s.e,
      kind === 'reorder' ? 'Reorder: ' + (ref || 'not specified') : 'Please call this customer back.',
      a.phone ? 'Customer phone: ' + a.phone : '',
    ].filter((l) => l !== null).join('\n');
    const to = [rep?.email, ...(process.env.FORM_TO_EMAIL || '').split(',')].map((x) => (x ?? '').trim()).filter(Boolean);
    const key = process.env.RESEND_API_KEY;
    if (key && to.length) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.FORM_FROM_EMAIL || 'Weldclass Website <onboarding@resend.dev>', to: [...new Set(to)], reply_to: s.e, subject, text }),
      });
      if (!r.ok) throw new Error('Email failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    } else {
      console.log('[portal request, email not set up]', subject + '\n' + text + '\nWould send to: ' + (to.join(', ') || 'nobody'));
    }
    return go(req, '/dealer/?requested=' + kind);
  } catch (e) {
    console.error('Portal request failed', (e as Error).message);
    return go(req, '/dealer/?reqerr=1');
  }
}
