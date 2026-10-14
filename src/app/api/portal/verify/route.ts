import { customersForEmail } from '@/lib/portal/data';
import { go } from '@/lib/portal/http';
import { makeSession, readLink, sessionCookie } from '@/lib/portal/session';

/** Dealer sign-in, step 2: the emailed link. Checks it, looks the dealer up again and starts a 12-hour session. */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const link = readLink(new URL(req.url).searchParams.get('t'));
  if (!link) return go(req, '/login/?expired=1');
  try {
    const ids = await customersForEmail(link.e);
    if (!ids.length) return go(req, '/login/?expired=1');
    return go(req, '/dealer/', sessionCookie(makeSession(link.e, ids)));
  } catch (e) {
    console.error('Dealer sign-in check failed', (e as Error).message);
    return go(req, '/login/?formerr=1');
  }
}
