/** Dealer portal pages: overview, invoices and orders, built from NetSuite data for the signed-in account. */
import { restletConfigured } from '../netsuite';
import { customers, invoices, orders, summary, type Customer, type Txn } from '../portal/data';
import type { Session } from '../portal/session';
import { crumbbar, type Crumb } from '../blocks';
import { esc, money, mod, pageUrl } from '../util';

export type PortalTab = 'overview' | 'invoices' | 'orders';
const TABS: [PortalTab, string, string][] = [
  ['overview', 'Overview', '/dealer/'],
  ['invoices', 'Invoices & credits', '/dealer/invoices/'],
  ['orders', 'Orders', '/dealer/orders/'],
];
const TYPE: Record<string, string> = { CustInvc: 'Invoice', CustCred: 'Credit memo', SalesOrd: 'Sales order' };

function pdfLink(t: Txn): string {
  return restletConfigured() ? '<a class="pt-pdf" href="/api/portal/pdf/?id=' + t.id + '" target="_blank" rel="noopener">PDF</a>' : '';
}

function status(t: Txn): string {
  if (t.overdue) return '<span class="pt-tag bad">Overdue</span>';
  return '<span class="pt-tag">' + esc(t.status || '') + '</span>';
}

function txnTable(rows: Txn[], kind: 'invoice' | 'order', empty: string): string {
  if (!rows.length) return '<p class="muted" style="margin:0">' + esc(empty) + '</p>';
  const head =
    kind === 'invoice'
      ? '<tr><th>Number</th><th>Type</th><th>Date</th><th>Due</th><th>Your PO</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th><th></th></tr>'
      : '<tr><th>Order</th><th>Date</th><th>Your PO</th><th class="r">Total</th><th>Status</th><th></th></tr>';
  const body = rows
    .map((t) =>
      kind === 'invoice'
        ? '<tr><td><b>' + esc(t.number) + '</b></td><td>' + esc(TYPE[t.type] ?? t.type) + '</td><td>' + esc(t.date) + '</td><td>' + esc(t.due) + '</td><td>' + esc(t.po) + '</td><td class="r">' + money(t.total) + '</td><td class="r">' + (t.remaining ? money(t.remaining) : '&ndash;') + '</td><td>' + status(t) + '</td><td>' + pdfLink(t) + '</td></tr>'
        : '<tr><td><b>' + esc(t.number) + '</b></td><td>' + esc(t.date) + '</td><td>' + esc(t.po) + '</td><td class="r">' + money(t.total) + '</td><td>' + status(t) + '</td><td>' + pdfLink(t) + '</td></tr>',
    )
    .join('');
  return '<div class="tbl pt-table"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
}

function stat(label: string, value: string, note: string, bad = false): string {
  return '<div class="pt-stat' + (bad ? ' bad' : '') + '"><span>' + esc(label) + '</span><b>' + value + '</b><small>' + esc(note) + '</small></div>';
}

function frame(s: Session, accts: Customer[], tab: PortalTab, inner: string): string {
  const cur = accts.find((c) => c.id === s.cur);
  const home: Crumb = ['Home', '/'];
  const switcher =
    accts.length > 1
      ? '<form method="post" action="/api/portal/switch/" class="pt-switch"><label for="pt-acct">Account</label><select id="pt-acct" name="c" onchange="this.form.submit()">' +
        accts.map((c) => '<option value="' + c.id + '"' + (c.id === s.cur ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
        '</select><noscript><button class="btn btn-l btn-sm" type="submit">Switch</button></noscript></form>'
      : '';
  return (
    crumbbar([home, ['Dealer portal', '']]) +
    '<section class="sec tight mist"><div class="wrap"><div class="pt">' +
    '<div class="pt-head"><div><div class="kick or">Dealer portal</div><h1 class="disp">' + esc(cur?.name ?? 'Your account') + '<span class="dot">.</span></h1>' +
    '<p class="muted">' + (cur?.number ? 'Account ' + esc(cur.number) + ' &middot; ' : '') + 'Signed in as ' + esc(s.e) + '</p></div>' +
    '<div class="pt-actions">' + switcher + '<form method="post" action="/api/portal/logout/"><button class="btn btn-l btn-sm" type="submit">Sign out</button></form></div></div>' +
    '<div class="note" role="status" data-notice="welcome" hidden><span><b>Password saved.</b> You&rsquo;re logged in. Next time, log in with your email and this password.</span></div>' +
    '<nav class="pt-tabs" aria-label="Dealer portal">' + TABS.map(([k, label, href]) => '<a href="' + href + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav>' +
    inner +
    '<p class="muted pt-help">Questions about your account? Call ' + esc(mod('phone')) + ' or <a href="' + pageUrl('contact') + '">contact us</a>.</p>' +
    '</div></div></section>'
  );
}

function failed(): string {
  return '<div class="note" role="alert" style="background:#FFF4CC;color:#6B4E00"><span><b>We could not load your account just now.</b> Please refresh in a minute, or call ' + esc(mod('phone')) + '.</span></div>';
}

export async function portalHtml(s: Session, tab: PortalTab, show = ''): Promise<string> {
  let accts: Customer[] = [];
  try {
    accts = await customers(s.c);
  } catch (e) {
    console.error('Dealer portal accounts failed', (e as Error).message);
    return frame(s, accts, tab, failed());
  }
  const cur = accts.find((c) => c.id === s.cur);
  let inner = '';
  try {
    if (tab === 'overview') {
      const [sum, open, recent] = await Promise.all([summary(s.cur), invoices(s.cur, true, 10), orders(s.cur, 5)]);
      inner =
        '<div class="pt-stats">' +
        stat('Open balance', money(sum.open), sum.openCount + ' open invoice' + (sum.openCount === 1 ? '' : 's')) +
        stat('Overdue', money(sum.overdue), sum.overdueCount ? sum.overdueCount + ' past due date' : 'Nothing overdue', sum.overdue > 0) +
        stat('Terms', esc(cur?.terms || 'Not set'), cur?.creditLimit ? 'Credit limit ' + money(cur.creditLimit) : '') +
        '</div>' +
        (restletConfigured() ? '<div class="pt-bar"><a class="btn btn-o btn-sm" href="/api/portal/pdf/?statement=1" target="_blank" rel="noopener">Download statement (PDF)</a></div>' : '') +
        '<div class="pt-card"><div class="pt-card-h"><h2>Open invoices</h2><a class="arrow" href="/dealer/invoices/">All invoices</a></div>' + txnTable(open, 'invoice', 'No open invoices. Your account is all paid up.') + '</div>' +
        '<div class="pt-card"><div class="pt-card-h"><h2>Recent orders</h2><a class="arrow" href="/dealer/orders/">All orders</a></div>' + txnTable(recent, 'order', 'No orders yet.') + '</div>';
    } else if (tab === 'invoices') {
      const openOnly = show === 'open';
      const rows = await invoices(s.cur, openOnly);
      inner =
        '<div class="pt-card"><div class="pt-card-h"><h2>Invoices &amp; credits</h2><div class="pt-filter"><a href="/dealer/invoices/"' + (openOnly ? '' : ' aria-current="true"') + '>All</a><a href="/dealer/invoices/?show=open"' + (openOnly ? ' aria-current="true"' : '') + '>Open only</a></div></div>' +
        txnTable(rows, 'invoice', openOnly ? 'No open invoices.' : 'No invoices yet.') + (rows.length >= 200 ? '<p class="muted">Showing the latest 200.</p>' : '') + '</div>';
    } else {
      const rows = await orders(s.cur);
      inner = '<div class="pt-card"><div class="pt-card-h"><h2>Orders</h2></div>' + txnTable(rows, 'order', 'No orders yet.') + (rows.length >= 100 ? '<p class="muted">Showing the latest 100.</p>' : '') + '</div>';
    }
  } catch (e) {
    console.error('Dealer portal data failed', (e as Error).message, (e as { body?: string }).body ?? '');
    inner = failed();
  }
  return frame(s, accts, tab, inner);
}
