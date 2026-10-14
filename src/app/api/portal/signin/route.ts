import { customersForEmail } from '@/lib/portal/data';
import { findUser, isLocked, recordFailure, recordLogin } from '@/lib/portal/db';
import { go } from '@/lib/portal/http';
import { hashPassword, verifyPassword } from '@/lib/portal/password';
import { makeSession, portalEnabled, sessionCookie } from '@/lib/portal/session';

/**
 * Dealer sign-in with username (or email) and password. After 5 wrong passwords the account is
 * locked for 15 minutes. NetSuite must still list the email on an active customer or contact.
 */
let dummy: Promise<string> | null = null;

export async function POST(req: Request) {
  if (!portalEnabled()) return go(req, '/login/?formerr=1');
  const fd = await req.formData();
  if (String(fd.get('website_url') ?? '')) return go(req, '/login/?bad=1'); // Spam trap.
  const login = String(fd.get('login') ?? '').trim().slice(0, 254);
  const password = String(fd.get('password') ?? '').slice(0, 200);
  if (!login || !password) return go(req, '/login/?bad=1');

  try {
    const user = await findUser(login);
    if (!user || !user.password_hash || user.disabled) {
      // Spend the same time as a real check, so response times don't reveal which accounts exist.
      dummy ??= hashPassword('not-a-real-password');
      await verifyPassword(password, await dummy);
      return go(req, '/login/?bad=1');
    }
    if (isLocked(user)) return go(req, '/login/?locked=1');
    if (!(await verifyPassword(password, user.password_hash))) {
      await recordFailure(user.id);
      return go(req, '/login/?bad=1');
    }
    const ids = await customersForEmail(user.email);
    if (!ids.length) return go(req, '/login/?inactive=1');
    await recordLogin(user.id);
    return go(req, '/dealer/', sessionCookie(makeSession(user.email, ids)));
  } catch (e) {
    console.error('Dealer sign-in failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return go(req, '/login/?formerr=1');
  }
}
