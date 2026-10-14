/**
 * Dealer portal accounts, stored in Postgres (Neon, added from the Vercel Marketplace).
 * Holds the login email, optional username and a scrypt password hash, plus lockout counters.
 * Who is a dealer is still decided by NetSuite at every sign-in. Server-only.
 */
import { neon } from '@neondatabase/serverless';

export type PortalUser = {
  id: number;
  email: string;
  username: string | null;
  password_hash: string | null;
  failed_count: number;
  locked_until: string | null;
  disabled: boolean;
};

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

function url(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function dbConfigured(): boolean {
  return Boolean(url());
}

let ready: Promise<void> | null = null;

/** The SQL client, with the table created on first use. */
async function db() {
  const sql = neon(url());
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS portal_users (
      id            serial PRIMARY KEY,
      email         text NOT NULL UNIQUE,
      username      text UNIQUE,
      password_hash text,
      failed_count  integer NOT NULL DEFAULT 0,
      locked_until  timestamptz,
      disabled      boolean NOT NULL DEFAULT false,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    )`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return sql;
}

/** Find an account by email or username (both case-insensitive). */
export async function findUser(login: string): Promise<PortalUser | null> {
  const sql = await db();
  const v = login.trim().toLowerCase();
  const rows = (await sql`SELECT id, email, username, password_hash, failed_count, locked_until, disabled FROM portal_users WHERE email = ${v} OR lower(username) = ${v} ORDER BY (email = ${v}) DESC LIMIT 1`) as PortalUser[];
  return rows[0] ?? null;
}

export function isLocked(u: PortalUser): boolean {
  return Boolean(u.locked_until && new Date(u.locked_until).getTime() > Date.now());
}

export async function recordFailure(id: number): Promise<void> {
  const sql = await db();
  await sql`UPDATE portal_users SET
      failed_count = failed_count + 1,
      locked_until = CASE WHEN failed_count + 1 >= ${MAX_FAILS} THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END,
      updated_at = now()
    WHERE id = ${id}`;
}

export async function recordLogin(id: number): Promise<void> {
  const sql = await db();
  await sql`UPDATE portal_users SET failed_count = 0, locked_until = NULL, last_login_at = now() WHERE id = ${id}`;
}

/** Create the account if needed and set its password (also clears any lockout). */
export async function setPassword(email: string, hash: string): Promise<void> {
  const sql = await db();
  await sql`INSERT INTO portal_users (email, password_hash) VALUES (${email.toLowerCase()}, ${hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_count = 0, locked_until = NULL, updated_at = now()`;
}

/** The current hash for an email ('' when there is no account or no password yet). */
export async function currentHash(email: string): Promise<string> {
  const sql = await db();
  const rows = (await sql`SELECT password_hash FROM portal_users WHERE email = ${email.toLowerCase()}`) as { password_hash: string | null }[];
  return rows[0]?.password_hash ?? '';
}
