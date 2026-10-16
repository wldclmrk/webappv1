/**
 * Distributor portal pages (dashboard, orders, invoices & statements, account), built from NetSuite
 * data for the signed-in account. Each panel loads on its own: if one NetSuite query fails, that
 * panel says so and the rest of the page still works.
 */
import { restletConfigured } from '../netsuite';
import { customers, invoices, summary, type Customer, type Txn } from '../portal/data';
import { account, addresses, frequentlyOrdered, isOpen, plainStatus, salesOrders, salesRep, type Account, type Order, type OrderStage } from '../portal/dashboard';
import type { Session } from '../portal/session';
import { esc, money, mod, pageUrl } from '../util';

export type PortalTab = 'overview' | 'orders' | 'invoices' | 'account';
const NAV: [PortalTab | 'shop', string, string][] = [
  ['overview', 'Dashboard', '/dealer/'],
  ['shop', 'Shop', '/'],
  ['orders', 'Orders', '/dealer/orders/'],
  ['invoices', 'Invoices & statements', '/dealer/invoices/'],
  ['account', 'Account', '/dealer/account/'],
];
const TYPE: Record<string, string> = { CustInvc: 'Invoice', CustCred: 'Credit memo', SalesOrd: 'Sales order' };

const svg = (d: string) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const IC = {
  box: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  doc: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'),
  chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
};

/* ---------- Small helpers ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** NetSuite dates arrive as "14/10/2026" (account preference). Show "14 Oct", adding the year when it isn't this year. */
function shortDate(d: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim());
  if (!m) return esc(d);
  const yr = Number(m[3]);
  return Number(m[1]) + ' ' + MONTHS[Number(m[2]) - 1] + (yr === new Date().getFullYear() ? '' : ' ' + yr);
}

function daysAgo(d: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim());
  if (!m) return 9999;
  return (Date.now() - new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime()) / 86_400_000;
}

function failed(e?: unknown, what = 'this section'): string {
  // Preview sites only (private to your Vercel team): show NetSuite's own error to speed up testing.
  const err = e as { message?: string; status?: number; body?: string } | undefined;
  const detail =
    err && process.env.VERCEL_ENV !== 'production'
      ? '<pre style="white-space:pre-wrap;font-size:12px;margin:8px 0 0">Preview only: ' + esc([err.message, err.status, err.body].filter(Boolean).join(' | ')) + '</pre>'
      : '';
  return '<div class="note pt-warn" role="alert"><span><b>We couldn&rsquo;t load ' + esc(what) + ' just now.</b> Please refresh in a minute, or call ' + esc(mod('phone')) + '.' + detail + '</span></div>';
}

async function safe<T>(fn: () => Promise<T>, label: string): Promise<{ ok: true; v: T } | { ok: false; e: unknown }> {
  try {
    return { ok: true, v: await fn() };
  } catch (e) {
    console.error('Distributor portal: ' + label + ' failed', (e as Error).message, (e as { body?: string }).body ?? '');
    return { ok: false, e };
  }
}

function pdfLink(id: number, label = 'PDF'): string {
  return restletConfigured() ? '<a class="pt-pdf" href="/api/portal/pdf/?id=' + id + '" target="_blank" rel="noopener">' + label + '</a>' : '';
}

function card(icon: string, title: string, inner: string, extra = '', sub = ''): string {
  return (
    '<section class="pd-card"><header class="pd-card-h"><span class="pd-ic">' + icon + '</span><h2>' + title + '</h2>' + (sub ? '<span class="pd-sub">' + sub + '</span>' : '') +
    (extra ? '<span class="pd-extra">' + extra + '</span>' : '') + '</header>' + inner + '</section>'
  );
}

/* ---------- Orders ---------- */

const STAGE: Record<OrderStage, [string, string]> = {
  received: ['Received', 'amber'],
  processing: ['Processing', 'blue'],
  picking: ['Picking', 'blue'],
  part: ['Part dispatched', 'amber'],
  dispatched: ['Dispatched', 'amber'],
  invoiced: ['Invoiced', 'green'],
  closed: ['Closed', 'grey'],
  cancelled: ['Cancelled', 'grey'],
};

function badge(o: Order): string {
  const [label, tone] = STAGE[o.stage];
  return '<span class="pd-badge ' + tone + '"><i></i>' + label + '</span>' + (o.backorder ? '<span class="pd-badge red">Part backorder</span>' : '');
}

function ordersTable(rows: Order[], empty: string): string {
  if (!rows.length) return '<p class="pd-empty">' + esc(empty) + '</p>';
  return (
    '<div class="pd-tbl"><table><thead><tr><th>Order</th><th>Your PO</th><th>Date</th><th class="r">Total inc GST</th><th>Status</th>' + (restletConfigured() ? '<th></th>' : '') + '</tr></thead><tbody>' +
    rows
      .map((o) => '<tr><td><b class="pd-num">' + esc(o.number) + '</b></td><td>' + esc(o.po) + '</td><td>' + shortDate(o.date) + '</td><td class="r">' + money(o.total) + '</td><td><span class="pd-badges">' + badge(o) + '</span></td>' + (restletConfigured() ? '<td>' + pdfLink(o.id) + '</td>' : '') + '</tr>')
      .join('') +
    '</tbody></table></div>'
  );
}

/* ---------- Invoices ---------- */

function invStatus(t: Txn): string {
  if (t.overdue) return '<span class="pd-badge red">Overdue</span>';
  if (t.remaining > 0) return '<span class="pd-badge blue">Open</span>';
  return '<span class="pd-badge green">' + esc(plainStatus(t.status) || 'Paid') + '</span>';
}

function invoiceTable(rows: Txn[], empty: string): string {
  if (!rows.length) return '<p class="pd-empty">' + esc(empty) + '</p>';
  return (
    '<div class="pd-tbl"><table><thead><tr><th>Number</th><th>Type</th><th>Date</th><th>Due</th><th>Your PO</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th>' + (restletConfigured() ? '<th></th>' : '') + '</tr></thead><tbody>' +
    rows
      .map((t) => '<tr><td><b class="pd-num">' + esc(t.number) + '</b></td><td>' + esc(TYPE[t.type] ?? t.type) + '</td><td>' + shortDate(t.date) + '</td><td>' + shortDate(t.due) + '</td><td>' + esc(t.po) + '</td><td class="r">' + money(t.total) + '</td><td class="r">' + (t.remaining ? money(t.remaining) : '&ndash;') + '</td><td>' + invStatus(t) + '</td>' + (restletConfigured() ? '<td>' + pdfLink(t.id) + '</td>' : '') + '</tr>')
      .join('') +
    '</tbody></table></div>'
  );
}

/* ---------- Frame ---------- */

function frame(s: Session, accts: Customer[], a: Account | null, tab: PortalTab, inner: string, heroButtons = ''): string {
  const cur = accts.find((c) => c.id === s.cur);
  const name = a?.name ?? cur?.name ?? 'Your account';
  const number = a?.number ?? cur?.number ?? '';
  const place = a ? [a.city, a.state].filter(Boolean).join(' ') : '';
  const switcher =
    accts.length > 1
      ? '<form method="post" action="/api/portal/switch/" class="pd-switch"><label for="pd-acct">Viewing account</label><select id="pd-acct" name="c" onchange="this.form.submit()">' +
        accts.map((c) => '<option value="' + c.id + '"' + (c.id === s.cur ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.number) + ')</option>').join('') +
        '</select><noscript><button type="submit">Switch</button></noscript></form>'
      : '';
  return (
    '<div class="pd">' +
    '<div class="pd-nav"><div class="wrap"><span class="pd-brand">Distributor<br>portal</span><nav aria-label="Distributor portal">' +
    NAV.map(([k, label, href]) => '<a href="' + href + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') +
    '</nav><div class="pd-me"><span class="pd-email">' + esc(s.e) + '</span><form method="post" action="/api/portal/logout/"><button type="submit">Sign out</button></form></div></div></div>' +
    '<header class="pd-hero"><div class="wrap"><div><div class="kick or">' + (tab === 'overview' ? 'Welcome back' : 'Distributor portal') + '</div><h1 class="disp">' + esc(name) + '<span class="dot">.</span></h1>' +
    '<p>' + (number ? 'Account ' + esc(number) : '') + (place ? ' &middot; ' + esc(place) : '') + '</p>' + switcher + '</div>' +
    '<div class="pd-hero-btns"><a class="btn btn-o" href="/">Shop the range</a>' + heroButtons + '</div></div></header>' +
    '<div class="pd-body"><div class="wrap">' +
    '<div class="note pd-ok" role="status" data-notice="welcome" hidden><span><b>Password saved.</b> You&rsquo;re logged in. Next time, log in with your email and this password.</span></div>' +
    '<div class="note pd-ok" role="status" data-notice="requested" hidden><span><b>Request sent.</b> Your Weldclass team will be in touch shortly.</span></div>' +
    '<div class="note pt-warn" role="alert" data-notice="reqerr" hidden><span><b>That request didn&rsquo;t send.</b> Please call ' + esc(mod('phone')) + '.</span></div>' +
    inner +
    '</div></div></div>'
  );
}

/* ---------- Pages ---------- */

export async function portalHtml(s: Session, tab: PortalTab, show = ''): Promise<string> {
  const accts = await safe(() => customers(s.c), 'accounts');
  const list = accts.ok ? accts.v : [];
  const acc = await safe(() => account(s.cur), 'account');
  if (!acc.ok) return frame(s, list, null, tab, failed(acc.e, 'your account'));
  const a = acc.v;

  if (tab === 'orders') {
    const o = await safe(() => salesOrders(a.id, 200), 'orders');
    const inner = '<div class="pd-one">' + card(IC.box, 'Orders', o.ok ? ordersTable(o.v, 'No orders yet.') + (o.v.length >= 200 ? '<p class="pd-foot">Showing the latest 200.</p>' : '') : failed(o.e, 'your orders')) + '</div>';
    return frame(s, list, a, tab, inner);
  }

  if (tab === 'invoices') {
    const openOnly = show === 'open';
    const inv = await safe(() => invoices(a.id, openOnly), 'invoices');
    const filter = '<span class="pd-filter"><a href="/dealer/invoices/"' + (openOnly ? '' : ' aria-current="true"') + '>All</a><a href="/dealer/invoices/?show=open"' + (openOnly ? ' aria-current="true"' : '') + '>Open only</a></span>';
    const stmt = restletConfigured() ? '<a class="btn btn-o btn-sm" href="/api/portal/pdf/?statement=1" target="_blank" rel="noopener">Download latest statement</a>' : '';
    const inner =
      '<div class="pd-one">' +
      card(IC.doc, 'Invoices &amp; credits', inv.ok ? invoiceTable(inv.v, openOnly ? 'No open invoices.' : 'No invoices yet.') : failed(inv.e, 'your invoices'), filter + stmt) +
      '</div>';
    return frame(s, list, a, tab, inner);
  }

  if (tab === 'account') {
    const [ad, rep] = [await safe(() => addresses(a.id), 'addresses'), await safe(() => salesRep(a.salesRep), 'sales rep')];
    const rows: [string, string][] = [
      ['Business', esc(a.name)],
      ['Account number', esc(a.number)],
      ['Payment terms', esc(a.terms || 'Not set')],
      ['Credit limit', a.creditLimit ? money(a.creditLimit) : 'Not set'],
      ['Price level', esc(a.priceLevel || 'Standard')],
      ['Accounts email', esc(a.email)],
      ['Phone', esc(a.phone)],
      ['Signed in as', esc(s.e)],
    ];
    const details = '<dl class="pd-dl">' + rows.filter((r) => r[1]).map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>';
    const addr = ad.ok ? (ad.v.length ? '<div class="pd-addr">' + ad.v.map((x) => '<div><b>' + esc(x.label) + '</b><p>' + esc(x.text).replace(/\r?\n/g, '<br>') + '</p></div>').join('') + '</div>' : '<p class="pd-empty">No addresses on file.</p>') : failed(ad.e, 'your addresses');
    const inner =
      '<div class="pd-grid">' +
      '<div class="pd-main">' + card(IC.user, 'Account details', details) + card(IC.box, 'Addresses', addr) + '</div>' +
      '<div class="pd-side">' + repCard(a, rep.ok ? rep.v : null) +
      card(IC.doc, 'Login', '<p class="pd-p">To change your password, use the reset link. We&rsquo;ll email you a link to set a new one.</p><a class="btn btn-l btn-sm" href="' + pageUrl('forgot') + '">Change password</a>') + '</div>' +
      '</div><p class="pd-foot">Need to update these details? Ask your account manager, or call ' + esc(mod('phone')) + '.</p>';
    return frame(s, list, a, tab, inner);
  }

  /* Dashboard */
  const orders = await safe(() => salesOrders(a.id, 60), 'orders');
  const sum = await safe(() => summary(a.id), 'balances');
  const openInv = await safe(() => invoices(a.id, true, 6), 'open invoices');
  const rep = await safe(() => salesRep(a.salesRep), 'sales rep');
  const freq = await safe(() => frequentlyOrdered(a, 10), 'frequently ordered');

  const latest = orders.ok ? orders.v[0] : undefined;
  const reorderBtn = latest
    ? '<form method="post" action="/api/portal/request/"><input type="hidden" name="kind" value="reorder"><input type="hidden" name="ref" value="' + esc(latest.number) + '"><button class="btn btn-g" type="submit">Request reorder ' + esc(latest.number) + '</button></form>'
    : '';
  const banner =
    latest && latest.stage === 'received' && daysAgo(latest.date) <= 14
      ? '<div class="pd-banner"><span class="pd-ic">' + IC.info + '</span><span><b>Order ' + esc(latest.number) + '</b>' + (latest.po ? ' (' + esc(latest.po) + ')' : '') + ' is received and with our team for processing.</span><a href="/dealer/orders/">View orders</a></div>'
      : '';

  // Tiles
  let tiles = '';
  if (orders.ok) {
    const open = orders.v.filter(isOpen);
    const notOut = open.filter((o) => o.stage === 'received' || o.stage === 'processing' || o.stage === 'picking').length;
    tiles += tile('blue', 'Open orders', String(open.length), notOut + ' not yet dispatched');
  } else tiles += tile('blue', 'Open orders', '&ndash;', 'Couldn&rsquo;t load');
  if (sum.ok) {
    const sv = sum.v;
    tiles += tile('orange', 'Balance owing', money(sv.open), sv.openCount + ' open invoice' + (sv.openCount === 1 ? '' : 's'));
    tiles += sv.overdue > 0 ? tile('red', 'Overdue', money(sv.overdue), sv.overdueCount + ' invoice' + (sv.overdueCount === 1 ? '' : 's') + ' past due', true) : tile('green', 'Overdue', money(0), 'Nothing overdue. Thanks.');
    if (a.creditLimit) {
      const avail = a.creditLimit - sv.open;
      const pct = Math.max(0, Math.min(100, (avail / a.creditLimit) * 100));
      tiles += tile('navy', 'Credit available', money(avail), 'Limit ' + money(a.creditLimit) + (a.terms ? ' &middot; ' + esc(a.terms) : ''), avail < 0, '<span class="pd-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span>');
    } else tiles += tile('navy', 'Payment terms', esc(a.terms || 'Not set'), 'No credit limit on file');
  } else {
    tiles += tile('orange', 'Balance owing', '&ndash;', 'Couldn&rsquo;t load') + tile('green', 'Overdue', '&ndash;', 'Couldn&rsquo;t load') + tile('navy', 'Credit available', '&ndash;', 'Couldn&rsquo;t load');
  }

  const recent = card(IC.box, 'Recent orders', orders.ok ? ordersTable(orders.v.slice(0, 7), 'No orders yet.') : failed(orders.e, 'your orders'), '<a href="/dealer/orders/">All orders</a>');

  const freqHtml = freq.ok
    ? freq.v.length
      ? '<div class="pd-tbl"><table><thead><tr><th>Part no.</th><th>Product</th><th class="r">Times</th><th class="r">Usual qty</th><th class="r">Your price ex GST</th></tr></thead><tbody>' +
        freq.v
          .map((f) => '<tr><td><b class="pd-num">' + esc(f.pn) + '</b></td><td>' + esc(f.name) + '<small>Last ordered ' + shortDate(f.last) + '</small></td><td class="r">' + f.times + '</td><td class="r">' + f.usual + '</td><td class="r">' + (f.price !== null ? money(f.price) : '&ndash;') + '</td></tr>')
          .join('') +
        '</tbody></table></div>'
      : '<p class="pd-empty">Once you&rsquo;ve ordered a few times, your regular parts will show here.</p>'
    : failed(freq.e, 'your frequently ordered parts');
  const frequent = card(IC.repeat, 'Frequently ordered', freqHtml, '', 'Your top 10 parts, last 12 months');

  const invHtml = openInv.ok
    ? openInv.v.length
      ? '<ul class="pd-inv">' + openInv.v.map((t) => '<li><div><b class="pd-num">' + esc(t.number) + '</b><small>Due ' + shortDate(t.due) + '</small></div><div class="r"><b>' + money(t.remaining) + '</b>' + invStatus(t) + '</div></li>').join('') + '</ul>'
      : '<p class="pd-empty">No open invoices. You&rsquo;re all paid up.</p>'
    : failed(openInv.e, 'your open invoices');
  const invCard = card(IC.doc, 'Open invoices', invHtml, '<a href="/dealer/invoices/?show=open">All</a>', sum.ok ? money(sum.v.open) + ' owing' : '');

  const inner =
    banner +
    '<div class="pd-tiles">' + tiles + '</div>' +
    '<div class="pd-grid"><div class="pd-main">' + recent + frequent + '</div><div class="pd-side">' + repCard(a, rep.ok ? rep.v : null) + invCard + '</div></div>';
  return frame(s, list, a, tab, inner, reorderBtn);
}

function tile(tone: string, label: string, value: string, note: string, bad = false, extra = ''): string {
  return '<div class="pd-tile ' + tone + (bad ? ' bad' : '') + '"><span>' + label + '</span><b>' + value + '</b><small>' + note + '</small>' + extra + '</div>';
}

function repCard(a: Account, rep: Awaited<ReturnType<typeof salesRep>>): string {
  const office = '<div class="pd-office"><span>Tamworth office</span><a href="tel:' + esc(mod('phone').replace(/\s+/g, '')) + '">' + esc(mod('phone')) + '</a></div>';
  const links =
    '<div class="pd-links"><span>Quick links</span><a href="/dealer/invoices/?show=open">' + IC.doc + 'Open invoices</a>' +
    (restletConfigured() ? '<a href="/api/portal/pdf/?statement=1" target="_blank" rel="noopener">' + IC.doc + 'Latest statement</a>' : '') +
    '<a href="/dealer/orders/">' + IC.repeat + 'Order history</a></div>';
  const callForm = (label: string) =>
    '<form method="post" action="/api/portal/request/"><input type="hidden" name="kind" value="call"><button class="btn btn-l btn-sm" type="submit">' + label + '</button></form>';
  if (!rep || !rep.name) {
    return card(IC.user, 'Your Weldclass team', '<p class="pd-p">Call us on ' + esc(mod('phone')) + ' for orders, pricing and account help.</p><div class="pd-rep-btns">' + callForm('Request a call') + '</div>' + links + office);
  }
  const initials = rep.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const mobile = rep.mobile || rep.phone;
  const line = (label: string, value: string, href: string, big = false) =>
    value ? '<div class="pd-line"><span>' + label + '</span><a href="' + esc(href) + '"' + (big ? ' class="big"' : '') + '>' + esc(value) + '</a><button type="button" class="pd-copy" data-copy="' + esc(value) + '" aria-label="Copy ' + label.toLowerCase() + '">' + IC.copy + '</button></div>' : '';
  const subject = encodeURIComponent('Account ' + a.number + ' (' + a.name + ')');
  return card(
    IC.user,
    'Your account manager',
    '<div class="pd-rep"><span class="pd-av">' + esc(initials) + '</span><div><b>' + esc(rep.name) + '</b><small>' + esc(rep.title) + '</small></div></div>' +
      '<div class="pd-contact">' + line('Mobile', mobile, 'tel:' + mobile.replace(/\s+/g, ''), true) + line('Email', rep.email, 'mailto:' + rep.email + '?subject=' + subject) + '</div>' +
      '<div class="pd-rep-btns">' + (rep.email ? '<a class="btn btn-b btn-sm" href="mailto:' + esc(rep.email) + '?subject=' + subject + '">Message ' + esc(rep.first || rep.name) + '</a>' : '') + callForm('Request a call') + '</div>' +
      links + office,
  );
}
