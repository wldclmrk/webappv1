import { netsuiteReport, p as product } from '@/lib/catalogue';
import { products } from '@/lib/content';
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

  // Image audit: /api/netsuite-check/?audit=images (add &format=csv for a spreadsheet)
  const q = new URL(req.url).searchParams;
  if (q.get('audit') === 'images') return imageAudit(q.get('format') === 'csv');

  // Part numbers coverage: /api/netsuite-check/?audit=parts (what this build took from NetSuite)
  if (q.get('audit') === 'parts') {
    const r = netsuiteReport();
    if (!r) return Response.json({ ok: false, error: 'This build has no NetSuite snapshot. Check PRODUCT_SOURCE=netsuite is set for Preview, then redeploy, and look for "[netsuite]" in the build log.' });
    const named = (ids: number[]) => ids.map((id) => ({ id, name: product(id)?.name ?? '', page: product(id)?.url ?? '', partNumbers: product(id)?.rec.part_numbers.length ?? 0 }));
    return Response.json(
      {
        ok: true,
        snapshotTaken: r.at,
        websiteItemsInNetSuite: r.items,
        productPages: r.products,
        productPagesBuiltFromNetSuite: named(r.fromNetSuite),
        productPagesHiddenNoNetSuiteItems: r.siteContentOnly.length,
        netsuiteItemsNotOnAnyPage: r.unplaced,
        fieldWarnings: r.warnings,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Transaction check: /api/netsuite-check/?audit=txn&customer=C09120 (tests each portal column on its own)
  if (q.get('audit') === 'txn') {
    const num = String(q.get('customer') ?? '').trim();
    if (!/^[\w-]{1,40}$/.test(num)) return Response.json({ ok: false, error: 'Add &customer= with the customer number, e.g. C09120.' }, { status: 400 });
    const [cu] = await suiteql<{ id: string; companyname: string }>('SELECT id, companyname FROM customer WHERE UPPER(entityid) = ' + sqlStr(num.toUpperCase()), 1);
    if (!cu) return Response.json({ ok: false, error: 'No customer with number ' + num });
    const where = ' FROM transaction t WHERE t.entity = ' + Number(cu.id);
    const cols = ['t.tranid', 't.trandate', 't.duedate', 't.type', 't.status', 'BUILTIN.DF(t.status) AS status_name', 't.foreigntotal', 't.foreignamountremaining', 't.otherrefnum', "CASE WHEN t.duedate < TRUNC(SYSDATE) THEN 'T' ELSE 'F' END AS overdue"];
    const checks = [
      await step('transaction types for this customer', () => suiteql('SELECT t.type, COUNT(*) AS count' + where + ' GROUP BY t.type')),
    ];
    for (const type of ['SalesOrd', 'CustInvc', 'CustCred']) {
      for (const c of cols) checks.push(await step(type + ': ' + c, () => suiteql('SELECT t.id, ' + c + where + ' AND t.type = ' + sqlStr(type) + ' ORDER BY t.id DESC', 2)));
    }
    return Response.json({ ok: checks.every((c) => c.ok), customer: cu, checks }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Customer part number check: /api/netsuite-check/?audit=crossref (&customer=C05639 to focus on one customer)
  if (q.get('audit') === 'crossref') {
    const num = String(q.get('customer') ?? '').trim();
    const checks = [
      await step('custom record types that look like cross-references', () =>
        suiteql("SELECT scriptid, name FROM customrecordtype WHERE LOWER(name) LIKE '%cross%' OR LOWER(name) LIKE '%part%' OR LOWER(name) LIKE '%customer item%' OR LOWER(scriptid) LIKE '%xref%' OR LOWER(scriptid) LIKE '%cross%'", 50)),
      await step('item fields that look like cross-references', () =>
        suiteql("SELECT scriptid, name, fieldtype FROM customfield WHERE fieldtype = 'ITEM' AND (LOWER(scriptid) LIKE '%cross%' OR LOWER(name) LIKE '%cross%' OR LOWER(name) LIKE '%part%')", 50)),
      await step('items with a saved cross-reference', () =>
        suiteql("SELECT itemid, custitem_weldclass_crossref_con_saved AS crossref FROM item WHERE custitem_weldclass_crossref_con_saved IS NOT NULL AND REPLACE(REPLACE(custitem_weldclass_crossref_con_saved, ',', ''), ' ', '') IS NOT NULL", 10)),
    ];
    // Show a few rows of each matching custom record so we can see which columns hold the customer and their part number.
    const types = (checks[0].ok ? (checks[0].result as { scriptid: string }[]) : []).slice(0, 6);
    for (const t of types) {
      const id = String(t.scriptid).toLowerCase();
      if (!/^customrecord[a-z0-9_]+$/.test(id)) continue;
      checks.push(await step('sample rows: ' + id, async () => (await suiteql<Record<string, unknown>>('SELECT * FROM ' + id, 5)).map(trim)));
    }
    // Known pair: &find=2-098FM&value=01663730 -> which field on that item holds the customer's number.
    const find = String(q.get('find') ?? '').trim();
    const value = String(q.get('value') ?? '').trim();
    if (find && /^[\w ./-]{1,60}$/.test(find)) {
      checks.push(await step('all filled-in fields on ' + find, async () => {
        const [row] = await suiteql<Record<string, unknown>>('SELECT * FROM item WHERE UPPER(itemid) = ' + sqlStr(find.toUpperCase()), 1);
        if (!row) return 'No item ' + find;
        return trim(Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && String(v).trim() !== '' && String(v) !== 'F')));
      }));
      if (value && /^[\w ./-]{1,60}$/.test(value)) {
        checks.push(await step('fields on ' + find + ' containing ' + value, async () => {
          const [row] = await suiteql<Record<string, unknown>>('SELECT * FROM item WHERE UPPER(itemid) = ' + sqlStr(find.toUpperCase()), 1);
          return row ? Object.entries(row).filter(([, v]) => String(v ?? '').includes(value)).map(([k, v]) => ({ field: k, value: v })) : [];
        }));
      }
    }
    if (value && /^[\w ./-]{1,60}$/.test(value)) {
      checks.push(await step('items whose combined cross-reference contains ' + value, () =>
        suiteql("SELECT itemid, custitem_weldclass_crossref_con_saved AS crossref FROM item WHERE custitem_weldclass_crossref_con_saved LIKE " + sqlStr('%' + value + '%'), 10)));
    }
    if (num && /^[\w-]{1,40}$/.test(num)) {
      checks.push(await step('customer ' + num, () => suiteql('SELECT id, companyname, entityid FROM customer WHERE UPPER(entityid) = ' + sqlStr(num.toUpperCase()), 1)));
    }
    return Response.json({ ok: true, checks }, { headers: { 'Cache-Control': 'no-store' } });
  }

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

/** Does an image URL load? (HEAD, falling back to a 1-byte GET for servers that refuse HEAD.) */
async function loads(url: string): Promise<boolean> {
  try {
    let r = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok && /^image\//.test(r.headers.get('content-type') ?? 'image/');
  } catch {
    return false;
  }
}

/** Every part number on the site, with its current site photo and the photo NetSuite holds for it. */
async function imageAudit(csv: boolean) {
  const ns = new Map<string, { main: string; second: string; web: string }>();
  const rows = await suiteql<Record<string, string>>(
    "SELECT itemid, custitem_itemimageurl AS main, custitem6 AS second, custitemshowproductonweb AS web FROM item WHERE isinactive = 'F' AND (custitemshowproductonweb = 'T' OR custitem_itemimageurl IS NOT NULL)",
    6000,
  );
  for (const r of rows) ns.set(String(r.itemid).toUpperCase(), { main: r.main ?? '', second: r.second ?? '', web: r.web ?? '' });

  const list = products.flatMap((x) => (x.parts ?? []).map((p) => ({ product: x.name, page: x.path, pn: p.pn, siteImage: Number(p.img) > 0 })));
  const out: { product: string; page: string; pn: string; siteImage: boolean; inNetSuite: boolean; netsuiteImage: string; netsuiteImageLoads: boolean | null; status: string }[] = [];
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        const n = ns.get(it.pn.toUpperCase());
        const url = n?.main ?? '';
        const ok = url ? await loads(url) : null;
        const status = it.siteImage
          ? url && ok ? 'OK: site photo, NetSuite photo also loads' : 'OK: site photo only'
          : url && ok ? 'FIXABLE: no site photo, NetSuite photo loads'
          : url ? 'MISSING: NetSuite photo link is broken'
          : n ? 'MISSING: no photo in NetSuite'
          : 'MISSING: part number not found in NetSuite';
        out.push({ ...it, inNetSuite: Boolean(n), netsuiteImage: url, netsuiteImageLoads: ok, status });
      }
    }),
  );
  out.sort((a, b) => a.product.localeCompare(b.product) || a.pn.localeCompare(b.pn));
  const summary: Record<string, number> = {};
  for (const r of out) summary[r.status] = (summary[r.status] ?? 0) + 1;

  if (csv) {
    const cell = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const body = ['Product,Page,Part number,Site photo,In NetSuite,NetSuite image URL,NetSuite image loads,Status']
      .concat(out.map((r) => [r.product, r.page, r.pn, r.siteImage ? 'Yes' : 'No', r.inNetSuite ? 'Yes' : 'No', r.netsuiteImage, r.netsuiteImageLoads === null ? '' : r.netsuiteImageLoads ? 'Yes' : 'No', r.status].map(cell).join(',')))
      .join('\r\n');
    return new Response('\ufeff' + body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="part-image-audit.csv"', 'Cache-Control': 'no-store' } });
  }
  return Response.json({ ok: true, parts: out.length, summary, problems: out.filter((r) => !r.status.startsWith('OK')) }, { headers: { 'Cache-Control': 'no-store' } });
}
