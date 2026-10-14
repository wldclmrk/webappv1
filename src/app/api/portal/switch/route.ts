import { go } from '@/lib/portal/http';
import { makeSession, sessionCookie, sessionFromRequest } from '@/lib/portal/session';

/** Switch between accounts when one email is a contact on more than one customer. */
export async function POST(req: Request) {
  const s = sessionFromRequest(req);
  if (!s) return go(req, '/login/?expired=1');
  const want = Number((await req.formData()).get('c'));
  if (!s.c.includes(want)) return go(req, '/dealer/');
  return go(req, '/dealer/', sessionCookie(makeSession(s.e, s.c, want)));
}
