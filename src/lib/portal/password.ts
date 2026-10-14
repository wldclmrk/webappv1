/**
 * Dealer portal passwords. Only a salted scrypt hash is stored (in the portal database), never the password. Server-only.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 32;
export const MIN_LENGTH = 10;

export function passwordProblem(pw: string, again: string): string | null {
  if (pw.length < MIN_LENGTH) return 'short';
  if (pw.length > 200) return 'long';
  if (pw !== again) return 'mismatch';
  return null;
}

/** "scrypt$N$r$p$salt$hash" (about 100 characters, fits a free-form text field). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64url');
  if (want.length !== LEN) return false;
  try {
    const got = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64url'), LEN, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(got, want);
  } catch {
    return false;
  }
}
