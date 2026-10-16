import { customers } from '@/lib/portal/data';
import { crossrefFor, partNumberMap } from '@/lib/portal/crossref';
import { sessionFromRequest } from '@/lib/portal/session';

/**
 * The signed-in customer's own part numbers, for swapping into product pages in the browser.
 * Only ever returns the list for the account in the session. Empty for customers without one.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const s = sessionFromRequest(req);
  if (!s) return Response.json({ label: '', map: {} }, { status: 401, headers });
  try {
    const [a] = await customers([s.cur]);
    const c = a ? crossrefFor(a) : null;
    if (!c) return Response.json({ label: '', map: {} }, { headers });
    const m = await partNumberMap(c);
    return Response.json({ label: c.label, map: Object.fromEntries(m) }, { headers });
  } catch (e) {
    console.error('Customer part numbers failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return Response.json({ label: '', map: {} }, { status: 502, headers });
  }
}
