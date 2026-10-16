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

/*
 * Invoice columns. NetSuite accounts differ in which "amount remaining" and "due date" fields SuiteQL
 * will return (an unsupported one fails the whole query with an "unexpected error"), so the first
 * request tests each candidate once and the working ones are reused. Overdue is worked out here
 * from the due date, not in SQL.
 */
let invCols: Promise<{ remaining: string | null; due: string | null }> | null = null;

async function works(col: string): Promise<boolean> {
  try {
    await suiteql("SELECT t.id, " + col + " AS v FROM transaction t WHERE t.type = 'CustInvc' ORDER BY t.id DESC", 1);
    return true;
  } catch {
    return false;
  }
}

function invoiceColumns() {
  invCols ??= (async () => {
    let remaining: string | null = null;
    for (const c of ['t.foreignamountremaining', 't.foreignamountunpaid', 't.amountremaining', 't.amountunpaid']) {
      if (await works(c)) { remaining = c; break; }
    }
    const due = (await works('t.duedate')) ? 't.duedate' : null;
    return { remaining, due };
  })().catch((e) => {
    invCols = null;
    throw e;
  });
  return invCols;
}

/** NetSuite status "A" is Open for both invoices and credit memos (it may arrive as "CustInvc:A"). */
const OPEN = "(t.status = 'A' OR t.status LIKE '%:A')";

function parseDate(d: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(d).trim());
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() : null;
}

function toTxn(r: Record<string, string>): Txn {
  const code = String(r.code ?? '').replace(/^.*:/, '');
  const total = num(r.foreigntotal);
  const remaining = r.remaining !== undefined ? num(r.remaining) : code === 'A' ? Math.abs(total) : 0;
  const due = r.due ?? '';
  const dueAt = parseDate(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id: Number(r.id), number: r.tranid ?? '', date: r.trandate ?? '', due, type: r.type ?? '', status: String(r.status ?? '').replace(/^.*?:\s*/, ''),
    total, remaining, po: r.otherrefnum ?? '', overdue: r.type === 'CustInvc' && remaining > 0 && dueAt !== null && dueAt < today.getTime(),
  };
}

/** Invoices and credit memos, newest first. openOnly limits to ones still open. */
export async function invoices(customer: number, openOnly = false, max = 200): Promise<Txn[]> {
  const c = await invoiceColumns();
  const cols =
    't.id, t.tranid, t.trandate, t.type, t.status AS code, BUILTIN.DF(t.status) AS status, t.foreigntotal, t.otherrefnum' +
    (c.remaining ? ', ' + c.remaining + ' AS remaining' : '') + (c.due ? ', ' + c.due + ' AS due' : '');
  const rows = await suiteql<Record<string, string>>(
    'SELECT ' + cols + ' FROM transaction t WHERE t.entity = ' + sqlId(customer) + " AND t.type IN ('CustInvc', 'CustCred')" +
      (openOnly ? ' AND ' + OPEN : '') + ' ORDER BY t.trandate DESC, t.id DESC',
    max,
  );
  return rows.map(toTxn);
}

export async function orders(customer: number, max = 100): Promise<Txn[]> {
  const rows = await suiteql<Record<string, string>>(
    "SELECT t.id, t.tranid, t.trandate, t.type, t.status AS code, BUILTIN.DF(t.status) AS status, t.foreigntotal, t.otherrefnum FROM transaction t WHERE t.entity = " + sqlId(customer) + " AND t.type = 'SalesOrd' ORDER BY t.trandate DESC, t.id DESC",
    max,
  );
  return rows.map((r) => ({ ...toTxn(r), remaining: 0, overdue: false }));
}

/** Balance owing and overdue, worked out from the open invoices themselves. */
export async function summary(customer: number): Promise<Summary> {
  const open = (await invoices(customer, true, 1000)).filter((t) => t.type === 'CustInvc' && t.remaining > 0);
  const late = open.filter((t) => t.overdue);
  const sum = (l: Txn[]) => Math.round(l.reduce((a, t) => a + t.remaining, 0) * 100) / 100;
  return { open: sum(open), overdue: sum(late), openCount: open.length, overdueCount: late.length };
}

/** True when the transaction belongs to this customer (checked before any PDF is rendered). */
export async function ownsTransaction(customer: number, id: number): Promise<boolean> {
  const rows = await suiteql('SELECT t.id FROM transaction t WHERE t.id = ' + sqlId(id) + ' AND t.entity = ' + sqlId(customer) + " AND t.type IN ('CustInvc', 'CustCred', 'SalesOrd')", 1);
  return rows.length === 1;
}

