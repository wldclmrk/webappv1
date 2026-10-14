import { NetSuiteError, accessToken, netsuiteConfigured, productSource, sqlStr, suiteql } from '@/lib/netsuite';

/**
 * Connection check for the NetSuite Sandbox: /api/netsuite-check/
 * Confirms the M2M sign-in works and shows how website items are structured, so the product mapping can be built.
 * Never returns credentials. Disabled on Production.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    return { step: name, ok: true, result: await fn() };
  } catch (e) {
    const err = e as NetSuiteError;
    return { step: name, ok: false, status: err.status ?? null, error: err.message, detail: err.body ?? null };
  }
}

/** Trim long values so the page stays readable. */
function trim(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' && v.length > 400 ? v.slice(0, 400) + '…' : v]));
}

const WEB = "custitemshowproductonweb = 'T' AND isinactive = 'F'";

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === 'production') return new Response('Not found', { status: 404 });
  if (!netsuiteConfigured()) {
    return Response.json({
      ok: false,
      productSource: productSource(),
      missing: ['NETSUITE_ACCOUNT_ID', 'NETSUITE_CLIENT_ID', 'NETSUITE_CERT_ID', 'NETSUITE_PRIVATE_KEY'].filter((k) => !process.env[k]),
      hint: 'Add the missing variables to the Preview environment, then redeploy.',
    });
  }
  const auth = await step('token', async () => ((await accessToken()) ? 'Signed in to NetSuite' : 'No token'));
  if (!auth.ok) return Response.json({ ok: false, productSource: productSource(), account: process.env.NETSUITE_ACCOUNT_ID, checks: [auth] }, { status: 502 });

  // Part number lookup: /api/netsuite-check/?pn=91300AMA1
  const pn = new URL(req.url).searchParams.get('pn')?.trim();
  if (pn) {
    if (!/^[\w ./\-[\]!]{1,60}$/.test(pn)) return Response.json({ ok: false, error: 'That does not look like a part number.' }, { status: 400 });
    const lookup = [
      await step('item', () =>
        suiteql('SELECT id, itemid, displayname, itemtype, custitem_rrp_incl_gst AS rrp_incl_gst, custitem_web_show_rrp AS show_rrp, custitemshowproductonweb AS on_web, custitem_weburl AS weburl, isinactive FROM item WHERE UPPER(itemid) = ' + sqlStr(pn.toUpperCase()), 5),
      ),
      await step('price levels', () =>
        suiteql('SELECT BUILTIN.DF(p.pricelevel) AS level, p.quantity, p.unitprice FROM pricing p WHERE p.item IN (SELECT id FROM item WHERE UPPER(itemid) = ' + sqlStr(pn.toUpperCase()) + ') ORDER BY p.pricelevel, p.quantity', 100),
      ),
    ];
    return Response.json({ ok: lookup.every((c) => c.ok), pn, checks: lookup }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // One at a time: NetSuite limits how many requests an account can run at once.
  const jobs: [string, () => Promise<unknown>][] = [
    ['web items by type', () => suiteql('SELECT itemtype, COUNT(*) AS count FROM item WHERE ' + WEB + ' GROUP BY itemtype')],
    ['cnc web items by type', () => suiteql("SELECT itemtype, COUNT(*) AS count FROM item WHERE custitemshowproductonweb_cnc = 'T' AND isinactive = 'F' GROUP BY itemtype")],
    ['web item samples (all fields)', async () => (await suiteql<Record<string, unknown>>('SELECT * FROM item WHERE ' + WEB + " AND itemtype = 'InvtPart' ORDER BY id DESC", 3)).map(trim)],
    ['web kit/group samples (all fields)', async () => (await suiteql<Record<string, unknown>>('SELECT * FROM item WHERE ' + WEB + " AND itemtype IN ('Kit', 'Group') ORDER BY id DESC", 2)).map(trim)],
    ['kit/group members', () => suiteql('SELECT BUILTIN.DF(m.parentitem) AS parent, BUILTIN.DF(m.item) AS member, m.quantity FROM itemmember m WHERE m.parentitem IN (SELECT id FROM item WHERE ' + WEB + " AND itemtype IN ('Kit', 'Group'))", 15)],
    ['pricing table', () => suiteql('SELECT BUILTIN.DF(p.item) AS item, BUILTIN.DF(p.pricelevel) AS level, p.unitprice, p.quantity FROM pricing p WHERE p.item IN (SELECT id FROM item WHERE ' + WEB + ')', 15)],
    ['rrp fields', () => suiteql('SELECT itemid, custitem_rrp_incl_gst, custitem_web_show_rrp, custitem_web_disallow_purchase FROM item WHERE ' + WEB + ' ORDER BY id DESC', 8)],
    ['commerce categories', () => suiteql('SELECT id, name, BUILTIN.DF(parentcategory) AS parent FROM commercecategory', 30)],
    ['item images', () => suiteql('SELECT * FROM itemimage', 3)],
    ['web item part numbers', async () => (await suiteql<{ itemid: string }>('SELECT itemid FROM item WHERE ' + WEB + ' ORDER BY itemid', 4000)).map((r) => r.itemid)],
  ];
  const checks = [];
  for (const [name, fn] of jobs) checks.push(await step(name, fn));
  return Response.json({ ok: checks.every((c) => c.ok), productSource: productSource(), account: process.env.NETSUITE_ACCOUNT_ID, checks: [auth, ...checks] }, { headers: { 'Cache-Control': 'no-store' } });
}
