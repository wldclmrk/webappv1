/**
 * Dealer portal sign-in: signed session cookie and emailed set/reset-password links.
 * Both are HMAC-signed with PORTAL_SECRET. A reset link carries a fingerprint of the current
 * password, so it stops working once used (or once the password changes). Server-only.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { netsuiteConfigured } from '../netsuite';
import { dbConfigured } from './db';

export const COOKIE = 'wc_dealer';
const LINK_MINUTES = 30;
const SESSION_HOURS = 12;

export type Session = { e: string; c: number[]; cur: number; exp: number };
type Link = { e: string; v: string; exp: number };

/** The portal is on when NetSuite and the database are connected and a signing secret is set. */
export function portalEnabled(): boolean {
  return netsuiteConfigured() && dbConfigured() && String(process.env.PORTAL_SECRET ?? '').length >= 32;
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

/** Fingerprint of the stored password hash ('' = none yet), so a used reset link is dead. */
export function hashVersion(hash: string): string {
  return mac('pwv', hash || 'none').slice(0, 16);
}

export function makeLink(email: string, currentHash: string): string {
  return seal('reset', { e: email, v: hashVersion(currentHash), exp: Date.now() + LINK_MINUTES * 60_000 } satisfies Link);
}

export function readLink(token: string | null | undefined): Link | null {
  return open<Link>('reset', token);
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
