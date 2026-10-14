import { restlet, restletConfigured } from '@/lib/netsuite';
import { ownsTransaction } from '@/lib/portal/data';
import { sessionFromRequest } from '@/lib/portal/session';

/**
 * Invoice, credit memo, sales order or statement PDF for the signed-in dealer.
 * ?id=<transaction id> or ?statement=1. Ownership is checked against the session's account first.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = sessionFromRequest(req);
  if (!s) return new Response('Please sign in again.', { status: 401 });
  if (!restletConfigured()) return new Response('PDFs are not set up yet.', { status: 503 });
  const q = new URL(req.url).searchParams;
  try {
    let params: Record<string, string | number>;
    if (q.get('statement')) {
      params = { kind: 'statement', customer: s.cur };
    } else {
      const id = Number(q.get('id'));
      if (!Number.isInteger(id) || id <= 0 || !(await ownsTransaction(s.cur, id))) return new Response('Not found', { status: 404 });
      params = { kind: 'transaction', id };
    }
    const r = await restlet<{ name?: string; pdf?: string; error?: string }>(params);
    if (!r.pdf) throw new Error(r.error || 'No PDF returned');
    const name = (r.name || 'weldclass.pdf').replace(/[^\w.-]+/g, '_');
    return new Response(Buffer.from(r.pdf, 'base64'), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="' + name + '"', 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    console.error('Dealer PDF failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return new Response('That PDF could not be produced. Please try again or call 02 6764 9590.', { status: 502 });
  }
}
