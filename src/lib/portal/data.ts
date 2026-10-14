/**
 * Dealer portal data from NetSuite (SuiteQL over the website's M2M connection).
 * Every query is scoped to a customer ID taken from the signed session, never from the browser.
 */
import { sqlId, sqlStr, suiteql } from '../netsuite';

export type Customer = { id: number; name: string; number: string; terms: string; creditLimit: number | null };
export type Txn = { id: number; number: string; date: string; due: string; type: string; status: string; total: number; remaining: number; po: string; overdue: boolean };
export type Summary = { open: number; overdue: number; openCount: number; overdueCount: number };

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Optional: only customers in these category IDs may sign in (PORTAL_CUSTOMER_CATEGORIES="3,7"). */
function categoryFilter(): string {
  const ids = String(process.env.PORTAL_CUSTOMER_CATEGORIES ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length ? ' AND cu.category IN (' + ids.join(',') + ')' : '';
}

/** Active customers this email may act for: the customer's own email, or an active contact on it. */
export async function customersForEmail(email: string): Promise<number[]> {
  const e = sqlStr(email.toLowerCase());
  const rows = await suiteql<{ id: string }>(
    'SELECT DISTINCT cu.id FROM customer cu WHERE cu.isinactive = \'F\'' + categoryFilter() +
      ' AND (LOWER(cu.email) = ' + e + ' OR cu.id IN (SELECT co.company FROM contact co WHERE co.isinactive = \'F\' AND LOWER(co.email) = ' + e + '))' +
      ' ORDER BY cu.id',
    20,
  );
  return rows.map((r) => Number(r.id));
}

export async function customers(ids: number[]): Promise<Customer[]> {
  if (!ids.length) return [];
  const rows = await suiteql<Record<string, string>>(
    'SELECT cu.id, cu.companyname, cu.entityid, BUILTIN.DF(cu.terms) AS terms, cu.creditlimit FROM customer cu WHERE cu.id IN (' + ids.map(sqlId).join(',') + ')',
  );
  const out = rows.map((r) => ({ id: Number(r.id), name: r.companyname || r.entityid, number: r.entityid ?? '', terms: r.terms ?? '', creditLimit: r.creditlimit ? Number(r.creditlimit) : null }));
  return ids.map((id) => out.find((c) => c.id === id)).filter((c): c is Customer => Boolean(c));
}

const TXN_COLS =
  "t.id, t.tranid, t.trandate, t.duedate, t.type, BUILTIN.DF(t.status) AS status, t.foreigntotal, t.foreignamountremaining, t.otherrefnum, CASE WHEN t.duedate < TRUNC(SYSDATE) AND t.foreignamountremaining > 0 THEN 'T' ELSE 'F' END AS overdue";

function toTxn(r: Record<string, string>): Txn {
  return {
    id: Number(r.id), number: r.tranid ?? '', date: r.trandate ?? '', due: r.duedate ?? '', type: r.type ?? '', status: r.status ?? '',
    total: num(r.foreigntotal), remaining: num(r.foreignamountremaining), po: r.otherrefnum ?? '', overdue: r.overdue === 'T',
  };
}

/** Invoices and credit memos, newest first. openOnly limits to items with an amount remaining. */
export async function invoices(customer: number, openOnly = false, max = 200): Promise<Txn[]> {
  const rows = await suiteql<Record<string, string>>(
    'SELECT ' + TXN_COLS + ' FROM transaction t WHERE t.entity = ' + sqlId(customer) + " AND t.type IN ('CustInvc', 'CustCred')" +
      (openOnly ? ' AND t.foreignamountremaining > 0' : '') + ' ORDER BY t.trandate DESC, t.id DESC',
    max,
  );
  return rows.map(toTxn);
}

export async function orders(customer: number, max = 100): Promise<Txn[]> {
  const rows = await suiteql<Record<string, string>>(
    // Sales orders have no amount remaining or due date, so they use their own, smaller column set.
    "SELECT t.id, t.tranid, t.trandate, t.type, BUILTIN.DF(t.status) AS status, t.foreigntotal, t.otherrefnum FROM transaction t WHERE t.entity = " + sqlId(customer) + " AND t.type = 'SalesOrd' ORDER BY t.trandate DESC, t.id DESC",
    max,
  );
  return rows.map(toTxn);
}

export async function summary(customer: number): Promise<Summary> {
  const [r] = await suiteql<Record<string, string>>(
    'SELECT SUM(t.foreignamountremaining) AS open, COUNT(*) AS opencount,' +
      ' SUM(CASE WHEN t.duedate < TRUNC(SYSDATE) THEN t.foreignamountremaining ELSE 0 END) AS overdue,' +
      ' SUM(CASE WHEN t.duedate < TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS overduecount' +
      ' FROM transaction t WHERE t.entity = ' + sqlId(customer) + " AND t.type = 'CustInvc' AND t.foreignamountremaining > 0",
  );
  return { open: num(r?.open), overdue: num(r?.overdue), openCount: num(r?.opencount), overdueCount: num(r?.overduecount) };
}

/** True when the transaction belongs to this customer (checked before any PDF is rendered). */
export async function ownsTransaction(customer: number, id: number): Promise<boolean> {
  const rows = await suiteql('SELECT t.id FROM transaction t WHERE t.id = ' + sqlId(id) + ' AND t.entity = ' + sqlId(customer) + " AND t.type IN ('CustInvc', 'CustCred', 'SalesOrd')", 1);
  return rows.length === 1;
}

