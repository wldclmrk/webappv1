/**
 * Dealer portal sign-in: emailed one-time links and a signed session cookie.
 * Stateless (no database): both are HMAC-signed with PORTAL_SECRET. Server-only.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { netsuiteConfigured } from '../netsuite';

export const COOKIE = 'wc_dealer';
const LINK_MINUTES = 15;
const SESSION_HOURS = 12;

export type Session = { e: string; c: number[]; cur: number; exp: number };
type Link = { e: string; exp: number };

/** The portal is on when NetSuite is connected and a signing secret is set. */
export function portalEnabled(): boolean {
  return netsuiteConfigured() && String(process.env.PORTAL_SECRET ?? '').length >= 32;
}

function mac(purpose: string, body: string): string {
  return createHmac('sha256', String(process.env.PORTAL_SECRET)).update(purpose + '.' + body).digest('base64url');
}

function seal(purpose: string, data: object): string {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  return body + '.' + mac(purpose, body);
}

function open<T extends { exp: number }>(purpose: string, token: string | undefined | null): T | null {
  if (!token || !portalEnabled()) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(mac(purpose, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function makeLink(email: string): string {
  return seal('link', { e: email, exp: Date.now() + LINK_MINUTES * 60_000 } satisfies Link);
}

export function readLink(token: string | null): Link | null {
  return open<Link>('link', token);
}

export function makeSession(email: string, customers: number[], cur = customers[0]): string {
  return seal('session', { e: email, c: customers.slice(0, 20), cur, exp: Date.now() + SESSION_HOURS * 3_600_000 } satisfies Session);
}

export function readSession(token: string | undefined): Session | null {
  const s = open<Session>('session', token);
  return s && s.c.includes(s.cur) ? s : null;
}

/** Read the session from a request's Cookie header (route handlers). */
export function sessionFromRequest(req: Request): Session | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return readSession(m ? decodeURIComponent(m[1]) : undefined);
}

export function sessionCookie(token: string): string {
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + SESSION_HOURS * 3600;
}

export function clearCookie(): string {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/** Simple, strict email check; also keeps the value safe to put in a SuiteQL literal. */
export function cleanEmail(v: unknown): string | null {
  const e = String(v ?? '').trim().toLowerCase();
  return e.length <= 254 && /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) ? e : null;
}
