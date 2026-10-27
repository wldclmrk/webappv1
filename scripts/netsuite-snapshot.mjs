/**
 * Build step: snapshot every website item from NetSuite into content/netsuite.json, which the site
 * reads for part number tables (part numbers, descriptions, RRPs, photos).
 *
 * Runs before `next build`. It only does anything when PRODUCT_SOURCE=netsuite and the NETSUITE_*
 * variables are set (the Preview environment for now). If NetSuite can't be reached the build
 * carries on with the previous content and says so in the build log, so a NetSuite outage never
 * stops a deploy.
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';

const OUT = new URL('../content/netsuite.json', import.meta.url);
const env = process.env;

if (String(env.PRODUCT_SOURCE ?? '').trim().toLowerCase() !== 'netsuite') {
  rmSync(OUT, { force: true });
  console.log('[netsuite] PRODUCT_SOURCE is not "netsuite": using the site content only.');
  process.exit(0);
}
for (const k of ['NETSUITE_ACCOUNT_ID', 'NETSUITE_CLIENT_ID', 'NETSUITE_CERT_ID', 'NETSUITE_PRIVATE_KEY']) {
  if (!env[k]) {
    rmSync(OUT, { force: true });
    console.warn('[netsuite] ' + k + ' is missing: using the site content only.');
    process.exit(0);
  }
}

const host = String(env.NETSUITE_ACCOUNT_ID).trim().toLowerCase().replace(/_/g, '-');
const base = 'https://' + host + '.suitetalk.api.netsuite.com/services/rest';
const b64 = (x) => Buffer.from(x).toString('base64url');

async function token() {
  const key = createPrivateKey(String(env.NETSUITE_PRIVATE_KEY).replace(/\\n/g, '\n').trim());
  const ec = key.asymmetricKeyType === 'ec';
  const aud = base + '/auth/oauth2/v1/token';
  const now = Math.floor(Date.now() / 1000);
  const input = b64(JSON.stringify({ alg: ec ? 'ES256' : 'PS256', typ: 'JWT', kid: String(env.NETSUITE_CERT_ID).trim() })) + '.' +
    b64(JSON.stringify({ iss: String(env.NETSUITE_CLIENT_ID).trim(), scope: ['rest_webservices'], aud, iat: now, exp: now + 300, jti: randomUUID() }));
  const sig = ec ? sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }) : sign('sha256', Buffer.from(input), { key, padding: 6, saltLength: 32 });
  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: input + '.' + b64(sig) }),
  });
  if (!res.ok) throw new Error('Token request failed: ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return (await res.json()).access_token;
}

async function suiteql(tok, q) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(base + '/query/v1/suiteql?limit=1000&offset=' + offset, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'transient' },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) throw new Error('SuiteQL failed: ' + res.status + ' ' + (await res.text()).slice(0, 300));
    const j = await res.json();
    for (const it of j.items) {
      delete it.links;
      rows.push(it);
    }
    if (!j.hasMore || rows.length >= 20000) return rows;
  }
}

try {
  const started = Date.now();
  const tok = await token();
  const rows = await suiteql(
    tok,
    'SELECT id, itemid, displayname, itemtype, custitem_weldclass_grp_desc AS grpdesc, custitem_weldclass_grp_id AS grpid,' +
      ' custitem_rrp_incl_gst AS rrp, custitem_web_show_rrp AS showrrp, custitem_itemimageurl AS img, custitem6 AS img2, custitem_weburl AS weburl,' +
      " custitem_web_disallow_purchase AS nobuy FROM item WHERE custitemshowproductonweb = 'T' AND isinactive = 'F' ORDER BY itemid",
  );
  const items = rows.map((r) => ({
    id: Number(r.id),
    pn: String(r.itemid ?? '').trim(),
    name: r.displayname ?? '',
    type: r.itemtype ?? '',
    desc: r.grpdesc ?? '',
    sort: r.grpid ?? '',
    rrp: r.rrp == null || r.rrp === '' ? null : Number(r.rrp),
    showRrp: r.showrrp === 'T',
    img: r.img ?? '',
    img2: r.img2 ?? '',
    weburl: r.weburl ?? '',
    noBuy: r.nobuy === 'T',
  }));
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), account: env.NETSUITE_ACCOUNT_ID, items }));
  console.log('[netsuite] Snapshot of ' + items.length + ' website items saved in ' + ((Date.now() - started) / 1000).toFixed(1) + 's.');
} catch (e) {
  console.warn('[netsuite] Could not reach NetSuite, building with the site content only: ' + e.message);
}
