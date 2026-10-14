/**
 * Distributor portal dashboard data from NetSuite. Every query is scoped to the customer ID in the
 * signed session. Each loader is independent, so one panel failing never blanks the whole page.
 */
import { sqlId, suiteql } from '../netsuite';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** "Sales Order : Pending Fulfillment" -> "Pending Fulfillment" */
export function plainStatus(s: string | undefined): string {
  return String(s ?? '').replace(/^.*?:\s*/, '').trim();
}

export type Account = {
  id: number; name: string; number: string; terms: string; creditLimit: number | null;
  priceLevelId: number | null; priceLevel: string; currency: number | null; salesRep: number | null;
  city: string; state: string; email: string; phone: string;
};

export async function account(customer: number): Promise<Account> {
  const [r] = await suiteql<Record<string, string>>(
    'SELECT cu.id, cu.companyname, cu.entityid, BUILTIN.DF(cu.terms) AS terms, cu.creditlimit, cu.pricelevel, BUILTIN.DF(cu.pricelevel) AS pricelevelname,' +
      ' cu.currency, cu.salesrep, cu.email, cu.phone FROM customer cu WHERE cu.id = ' + sqlId(customer),
    1,
  );
  if (!r) throw new Error('Customer not found');
  const a: Account = {
    id: Number(r.id), name: r.companyname || r.entityid, number: r.entityid ?? '', terms: r.terms ?? '', creditLimit: r.creditlimit ? Number(r.creditlimit) : null,
    priceLevelId: r.pricelevel ? Number(r.pricelevel) : null, priceLevel: r.pricelevelname ?? '', currency: r.currency ? Number(r.currency) : null,
    salesRep: r.salesrep ? Number(r.salesrep) : null, city: '', state: '', email: r.email ?? '', phone: r.phone ?? '',
  };
  try {
    const [ad] = await suiteql<Record<string, string>>(
      'SELECT ea.city, ea.state FROM customer cu JOIN entityaddress ea ON ea.nkey = cu.defaultbillingaddress WHERE cu.id = ' + sqlId(customer),
      1,
    );
    a.city = ad?.city ?? '';
    a.state = ad?.state ?? '';
  } catch {
    // Address is a nice-to-have in the header.
  }
  return a;
}

export type Address = { label: string; text: string };

/** Default billing and shipping addresses, as printed text. */
export async function addresses(customer: number): Promise<Address[]> {
  const rows = await suiteql<Record<string, string>>(
    "SELECT 'Billing' AS label, ea.addrtext FROM customer cu JOIN entityaddress ea ON ea.nkey = cu.defaultbillingaddress WHERE cu.id = " + sqlId(customer) +
      " UNION ALL SELECT 'Delivery' AS label, ea.addrtext FROM customer cu JOIN entityaddress ea ON ea.nkey = cu.defaultshippingaddress WHERE cu.id = " + sqlId(customer),
    4,
  );
  return rows.map((r) => ({ label: r.label, text: r.addrtext ?? '' })).filter((a) => a.text);
}

export type Rep = { name: string; first: string; title: string; mobile: string; phone: string; email: string };

export async function salesRep(id: number | null): Promise<Rep | null> {
  if (!id) return null;
  const [r] = await suiteql<Record<string, string>>('SELECT e.firstname, e.lastname, e.title, e.mobilephone, e.phone, e.email FROM employee e WHERE e.id = ' + sqlId(id), 1);
  if (!r) return null;
  return { name: [r.firstname, r.lastname].filter(Boolean).join(' '), first: r.firstname ?? '', title: r.title ?? '', mobile: r.mobilephone ?? '', phone: r.phone ?? '', email: r.email ?? '' };
}

/* ---------- Orders ---------- */

export type OrderStage = 'received' | 'processing' | 'picking' | 'dispatched' | 'part' | 'invoiced' | 'closed' | 'cancelled';
export type Order = { id: number; number: string; date: string; po: string; total: number; status: string; stage: OrderStage; backorder: boolean };

/**
 * NetSuite sales order status codes -> what the dealer sees.
 * A Pending Approval, B Pending Fulfillment, C Cancelled, D Partially Fulfilled,
 * E Pending Billing/Partially Fulfilled, F Pending Billing, G Billed, H Closed.
 */
function stageOf(code: string): { stage: OrderStage; backorder: boolean } {
  switch (code.replace(/^.*:/, '')) {
    case 'A': return { stage: 'received', backorder: false };
    case 'B': return { stage: 'processing', backorder: false };
    case 'C': return { stage: 'cancelled', backorder: false };
    case 'D':
    case 'E': return { stage: 'part', backorder: true };
    case 'F': return { stage: 'dispatched', backorder: false };
    case 'G': return { stage: 'invoiced', backorder: false };
    default: return { stage: 'closed', backorder: false };
  }
}

export async function salesOrders(customer: number, max = 100): Promise<Order[]> {
  const rows = await suiteql<Record<string, string>>(
    'SELECT t.id, t.tranid, t.trandate, t.otherrefnum, t.foreigntotal, t.status, BUILTIN.DF(t.status) AS statusname FROM transaction t' +
      ' WHERE t.entity = ' + sqlId(customer) + " AND t.type = 'SalesOrd' ORDER BY t.trandate DESC, t.id DESC",
    max,
  );
  const out = rows.map((r) => ({
    id: Number(r.id), number: r.tranid ?? '', date: r.trandate ?? '', po: r.otherrefnum ?? '', total: num(r.foreigntotal),
    status: plainStatus(r.statusname), ...stageOf(String(r.status ?? '')),
  }));
  // Orders waiting on the warehouse: show "Picking" once a fulfilment exists that is picked or packed.
  const waiting = out.filter((o) => o.stage === 'processing').map((o) => o.id);
  if (waiting.length) {
    try {
      const f = await suiteql<{ so: string; st: string }>(
        "SELECT DISTINCT tl.createdfrom AS so, t.status AS st FROM transaction t JOIN transactionline tl ON tl.transaction = t.id WHERE t.type = 'ItemShip' AND tl.createdfrom IN (" +
          waiting.map(sqlId).join(',') + ')',
        500,
      );
      for (const r of f) {
        const o = out.find((x) => x.id === Number(r.so));
        if (!o) continue;
        const st = String(r.st).replace(/^.*:/, '');
        if (st === 'C') o.stage = 'dispatched';
        else if (o.stage === 'processing') o.stage = 'picking';
      }
    } catch {
      // Fulfilment detail is optional; "Processing" is still right.
    }
  }
  return out;
}

export function isOpen(o: Order): boolean {
  return o.stage === 'received' || o.stage === 'processing' || o.stage === 'picking' || o.stage === 'part';
}

/* ---------- Frequently ordered ---------- */

export type Frequent = { item: number; pn: string; name: string; times: number; last: string; usual: number; price: number | null };

export async function frequentlyOrdered(a: Account, limit = 10): Promise<Frequent[]> {
  const rows = await suiteql<Record<string, string>>(
    'SELECT tl.item, i.itemid, i.displayname, COUNT(DISTINCT t.id) AS times, MAX(t.trandate) AS lastdate, SUM(ABS(tl.quantity)) AS qty' +
      ' FROM transaction t JOIN transactionline tl ON tl.transaction = t.id JOIN item i ON i.id = tl.item' +
      ' WHERE t.entity = ' + sqlId(a.id) + " AND t.type = 'SalesOrd' AND tl.mainline = 'F' AND tl.taxline = 'F'" +
      " AND i.itemtype IN ('InvtPart', 'Assembly', 'Kit', 'NonInvtPart', 'Group') AND t.trandate >= ADD_MONTHS(TRUNC(SYSDATE), -12)" +
      ' GROUP BY tl.item, i.itemid, i.displayname ORDER BY COUNT(DISTINCT t.id) DESC, MAX(t.trandate) DESC',
    limit,
  );
  const list: Frequent[] = rows.map((r) => {
    const times = Math.max(1, num(r.times));
    return { item: Number(r.item), pn: r.itemid ?? '', name: r.displayname || r.itemid || '', times, last: r.lastdate ?? '', usual: Math.max(1, Math.round(num(r.qty) / times)), price: null };
  });
  if (list.length && a.priceLevelId) {
    const prices = await yourPrices(a, list.map((f) => f.item));
    for (const f of list) f.price = prices.get(f.item) ?? null;
  }
  return list;
}

/** The customer's price level, first quantity tier, in their currency (ex GST). */
export async function yourPrices(a: Account, items: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!items.length || !a.priceLevelId) return out;
  const base = 'SELECT p.item, MIN(p.unitprice) AS price FROM pricing p WHERE p.pricelevel = ' + sqlId(a.priceLevelId) + ' AND p.item IN (' + items.map(sqlId).join(',') + ')';
  let rows: Record<string, string>[];
  try {
    rows = await suiteql(base + ' AND p.quantity = 1' + (a.currency ? ' AND p.currency = ' + sqlId(a.currency) : '') + ' GROUP BY p.item', 500);
  } catch {
    rows = await suiteql(base + ' AND p.quantity = 1 GROUP BY p.item', 500);
  }
  for (const r of rows) out.set(Number(r.item), num(r.price));
  return out;
}
