/**
 * NetSuite client: OAuth 2.0 Client Credentials (M2M) with a certificate, plus SuiteQL.
 * Server-only. Reads NETSUITE_ACCOUNT_ID, NETSUITE_CLIENT_ID, NETSUITE_CERT_ID and NETSUITE_PRIVATE_KEY.
 * Secrets never leave this module and are never logged.
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';

type Token = { value: string; expires: number };
let cached: Token | null = null;

export function netsuiteConfigured(): boolean {
  return Boolean(process.env.NETSUITE_ACCOUNT_ID && process.env.NETSUITE_CLIENT_ID && process.env.NETSUITE_CERT_ID && process.env.NETSUITE_PRIVATE_KEY);
}

/** Products come from NetSuite only when PRODUCT_SOURCE=netsuite; anything else (or unset) means the JSON content. */
export function productSource(): 'netsuite' | 'json' {
  return process.env.PRODUCT_SOURCE?.trim().toLowerCase() === 'netsuite' ? 'netsuite' : 'json';
}

/** "1234567_SB1" -> "1234567-sb1", the form NetSuite uses in host names. */
function accountHost(): string {
  return String(process.env.NETSUITE_ACCOUNT_ID).trim().toLowerCase().replace(/_/g, '-');
}

export function baseUrl(): string {
  return 'https://' + accountHost() + '.suitetalk.api.netsuite.com/services/rest';
}

function b64url(x: Buffer | string): string {
  return Buffer.from(x).toString('base64url');
}

/** Vercel sometimes stores pasted keys with literal "\n"; put real line breaks back. */
function privateKey() {
  const pem = String(process.env.NETSUITE_PRIVATE_KEY).replace(/\\n/g, '\n').trim();
  return createPrivateKey(pem);
}

function clientAssertion(aud: string): string {
  const key = privateKey();
  const isEc = key.asymmetricKeyType === 'ec';
  const header = { alg: isEc ? 'ES256' : 'PS256', typ: 'JWT', kid: String(process.env.NETSUITE_CERT_ID).trim() };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: String(process.env.NETSUITE_CLIENT_ID).trim(), scope: ['rest_webservices'], aud, iat: now, exp: now + 300, jti: randomUUID() };
  const input = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const sig = isEc
    ? sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
    : sign('sha256', Buffer.from(input), { key, padding: 6 /* RSA_PKCS1_PSS_PADDING */, saltLength: 32 });
  return input + '.' + b64url(sig);
}

export class NetSuiteError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Get (and cache) an access token. NetSuite M2M tokens last 60 minutes. */
export async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  const url = baseUrl() + '/auth/oauth2/v1/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion(url),
  });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new NetSuiteError('Token request failed', res.status, text.slice(0, 500));
  const j = JSON.parse(text) as { access_token: string; expires_in: number | string };
  cached = { value: j.access_token, expires: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return cached.value;
}

/** Run a SuiteQL query and return all rows (follows paging up to maxRows). */
export async function suiteql<T = Record<string, unknown>>(q: string, maxRows = 5000): Promise<T[]> {
  const token = await accessToken();
  const rows: T[] = [];
  let offset = 0;
  const limit = Math.min(1000, maxRows);
  for (;;) {
    const res = await fetch(baseUrl() + '/query/v1/suiteql?limit=' + limit + '&offset=' + offset, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'transient' },
      body: JSON.stringify({ q }),
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) throw new NetSuiteError('SuiteQL failed', res.status, text.slice(0, 500));
    const j = JSON.parse(text) as { items: (T & { links?: unknown })[]; hasMore: boolean };
    for (const it of j.items) {
      delete it.links;
      rows.push(it);
    }
    offset += limit;
    if (!j.hasMore || rows.length >= maxRows) return rows;
  }
}
