/**
 * NetSuite client: OAuth 2.0 Client Credentials (M2M) with a certificate, plus SuiteQL.
 * Server-only. Reads NETSUITE_ACCOUNT_ID, NETSUITE_CLIENT_ID, NETSUITE_CERT_ID and NETSUITE_PRIVATE_KEY.
 * Secrets never leave this module and are never logged.
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';

type Token = { value: string; expires: number };
type Scope = 'rest_webservices' | 'restlets';
const cached: Partial<Record<Scope, Token>> = {};

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

function clientAssertion(aud: string, scope: Scope): string {
  const key = privateKey();
  const isEc = key.asymmetricKeyType === 'ec';
  const header = { alg: isEc ? 'ES256' : 'PS256', typ: 'JWT', kid: String(process.env.NETSUITE_CERT_ID).trim() };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: String(process.env.NETSUITE_CLIENT_ID).trim(), scope: [scope], aud, iat: now, exp: now + 300, jti: randomUUID() };
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

/** Get (and cache) an access token for a scope. NetSuite M2M tokens last 60 minutes. */
export async function accessToken(scope: Scope = 'rest_webservices'): Promise<string> {
  const hit = cached[scope];
  if (hit && hit.expires > Date.now() + 60_000) return hit.value;
  const url = baseUrl() + '/auth/oauth2/v1/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion(url, scope),
  });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new NetSuiteError('Token request failed', res.status, text.slice(0, 500));
  const j = JSON.parse(text) as { access_token: string; expires_in: number | string };
  cached[scope] = { value: j.access_token, expires: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return j.access_token;
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

/** Quote a value for a SuiteQL string literal (SuiteQL over REST has no bind parameters). */
export function sqlStr(v: string): string {
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/** A whole-number ID for SuiteQL, or throws. */
export function sqlId(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Bad id');
  return n;
}

/**
 * Call the Weldclass portal RESTlet (netsuite/weldclass_portal_restlet.js), deployed in NetSuite.
 * NETSUITE_PORTAL_RESTLET holds its script and deployment, e.g. "customscript_wc_portal&deploy=customdeploy_wc_portal".
 */
export function restletConfigured(): boolean {
  return netsuiteConfigured() && Boolean(process.env.NETSUITE_PORTAL_RESTLET);
}

export async function restlet<T>(params: Record<string, string | number>): Promise<T> {
  const token = await accessToken('restlets');
  const [script, deploy] = String(process.env.NETSUITE_PORTAL_RESTLET).replace(/^.*script=/, '').split('&deploy=');
  const q = new URLSearchParams({ script, deploy: deploy ?? '1' });
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  const url = 'https://' + accountHost() + '.restlets.api.netsuite.com/app/site/hosting/restlet.nl?' + q.toString();
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new NetSuiteError('RESTlet failed', res.status, text.slice(0, 500));
  return JSON.parse(text) as T;
}
