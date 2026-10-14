import { customersForEmail } from '@/lib/portal/data';
import { currentHash, setPassword } from '@/lib/portal/db';
import { go } from '@/lib/portal/http';
import { hashPassword, passwordProblem } from '@/lib/portal/password';
import { hashVersion, makeSession, readLink, sessionCookie } from '@/lib/portal/session';

/** Saves a new password from an emailed link, then signs the dealer in. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const t = String(fd.get('t') ?? '');
  const link = readLink(t);
  if (!link) return go(req, '/forgot/?expired=1');
  const problem = passwordProblem(String(fd.get('password') ?? ''), String(fd.get('password2') ?? ''));
  if (problem) return go(req, '/dealer/set-password/?t=' + encodeURIComponent(t) + '&' + problem + '=1');

  try {
    if (hashVersion(await currentHash(link.e)) !== link.v) return go(req, '/forgot/?expired=1'); // Already used.
    const ids = await customersForEmail(link.e);
    if (!ids.length) return go(req, '/forgot/?expired=1');
    await setPassword(link.e, await hashPassword(String(fd.get('password'))));
    return go(req, '/dealer/?welcome=1', sessionCookie(makeSession(link.e, ids)));
  } catch (e) {
    console.error('Dealer set password failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return go(req, '/dealer/set-password/?t=' + encodeURIComponent(t) + '&formerr=1');
  }
}
