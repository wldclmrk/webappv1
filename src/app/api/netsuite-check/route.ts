import { NetSuiteError, accessToken, netsuiteConfigured, productSource, suiteql } from '@/lib/netsuite';

/**
 * Connection check for the NetSuite Sandbox: /api/netsuite-check/
 * Confirms the M2M sign-in works and shows how items are structured, so the product mapping can be built.
 * Never returns credentials. Disabled on Production.
 */
export const dynamic = 'force-dynamic';

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    return { step: name, ok: true, result: await fn() };
  } catch (e) {
    const err = e as NetSuiteError;
    return { step: name, ok: false, status: err.status ?? null, error: err.message, detail: err.body ?? null };
  }
}

export async function GET() {
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

  const checks = [
    auth,
    await step('item types', () => suiteql('SELECT itemtype, COUNT(*) AS count FROM item GROUP BY itemtype')),
    await step('website flag', () => suiteql("SELECT isonline, COUNT(*) AS count FROM item WHERE isinactive = 'F' GROUP BY isonline")),
    await step('matrix children', () => suiteql('SELECT COUNT(*) AS count FROM item WHERE parent IS NOT NULL')),
    await step('price levels', () => suiteql('SELECT id, name FROM pricelevel')),
    await step('sample item fields', async () => {
      const [row] = await suiteql("SELECT * FROM item WHERE isinactive = 'F' AND itemtype = 'InvtPart'", 1);
      return row ? Object.keys(row).sort() : [];
    }),
    await step('sample items', () => suiteql("SELECT id, itemid, displayname, itemtype, isonline, parent FROM item WHERE isinactive = 'F' ORDER BY id", 10)),
  ];
  return Response.json({ ok: checks.every((c) => c.ok), productSource: productSource(), account: process.env.NETSUITE_ACCOUNT_ID, checks }, { headers: { 'Cache-Control': 'no-store' } });
}
