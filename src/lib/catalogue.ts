/**
 * Catalogue data layer: categories, products, part numbers and search.
 *
 * This is the seam for NetSuite. Pages only use the functions exported here. When the build has a
 * NetSuite snapshot (content/netsuite.json, written by scripts/netsuite-snapshot.mjs), part number
 * tables come from NetSuite; otherwise from the site content.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arr, categories, compares, products, site, str, type Faq, type Part, type ProductRecord, type Review, type TermRecord } from './content';
import { money, txt } from './util';

/* ---------- Categories ---------- */

export type Term = TermRecord;

const TERMS = new Map<number, Term>(categories.terms.map((t) => [Number(t.id), t]));
const TERM_BY_PATH = new Map<string, Term>(categories.terms.map((t) => [t.path, t]));

export function term(id: number | string): Term | null {
  return TERMS.get(Number(id)) ?? null;
}
export function termByPath(path: string): Term | null {
  return TERM_BY_PATH.get(path) ?? null;
}
export function allTerms(): Term[] {
  return categories.terms;
}
export function tops(): Term[] {
  return categories.tops.map((id) => term(id)).filter((t): t is Term => !!t);
}
export function subs(top: Term | null): Term[] {
  return (top?.subs ?? []).map((id) => term(id)).filter((t): t is Term => !!t);
}
export function topLabel(t: Term): string {
  return t.label ? t.label : t.name;
}
export function termUrl(t: Term): string {
  return t.path;
}
/** Product IDs in a sub-category, in their featured order. */
export function prodsIn(sub: Term | null): number[] {
  return (sub?.items ?? []).map(Number);
}
/** Unique product IDs across a top category's subs, in order. */
export function topItems(top: Term): number[] {
  const out: number[] = [];
  for (const s of subs(top)) for (const id of prodsIn(s)) if (!out.includes(id)) out.push(id);
  return out;
}
export function topOf(sub: Term | null): Term | null {
  return sub && sub.parent ? term(sub.parent) : null;
}

/* ---------- Products ---------- */

const PRODUCTS = new Map<number, ProductRecord>(products.map((p) => [Number(p.id), p]));
const PRODUCT_BY_SLUG = new Map<string, ProductRecord>(products.map((p) => [p.slug, p]));

export type P = {
  id: number;
  rec: ProductRecord;
  name: string;
  url: string;
  img: number;
  gallery: number[];
  blurb: string;
  brand: string;
  series: string;
  summary: string;
  who: string;
  aka: string;
  rating: string;
  review_cnt: number;
  prices: number[];
  from: number | null;
  menu_order: number;
  date: number;
  pulse: boolean;
};

const P_CACHE = new Map<number, P | null>();

/** Lightweight product record used by cards, product pages, search and SEO. */
export function p(id: number | string): P | null {
  const n = Number(id);
  if (P_CACHE.has(n)) return P_CACHE.get(n)!;
  const r = PRODUCTS.get(n);
  if (!r) {
    P_CACHE.set(n, null);
    return null;
  }
  const out: P = {
    id: n,
    rec: r,
    name: r.name,
    url: r.path,
    img: Number(r.img) || 0,
    gallery: (r.gallery ?? []).map(Number),
    blurb: txt(r.short),
    brand: r.brand,
    series: r.series,
    summary: str(r.meta.summary),
    who: str(r.meta.who),
    aka: str(r.meta.aka),
    rating: str(r.meta.rating),
    review_cnt: Number(r.meta.review_count) || 0,
    prices: netsuite().prices.get(n) ?? (r.prices ?? []).map(Number),
    from: netsuite().prices.has(n) ? (netsuite().prices.get(n)!.length ? Math.min(...netsuite().prices.get(n)!) : null) : r.from == null ? null : Number(r.from),
    menu_order: Number(r.menu_order) || 0,
    date: Math.floor(new Date(r.date).getTime() / 1000),
    pulse: /pulse/i.test(r.name),
  };
  P_CACHE.set(n, out);
  return out;
}

export function productBySlug(slug: string): P | null {
  const r = PRODUCT_BY_SLUG.get(slug);
  return r ? p(r.id) : null;
}

/** All product IDs, oldest first. */
export function allProductIds(): number[] {
  return products.map((x) => Number(x.id)).sort((a, b) => a - b);
}

/** Part numbers: SKU, description, RRP and thumbnail per variation (from NetSuite when the build has a snapshot). */
export function parts(id: number): Part[] {
  const ns = netsuite().parts.get(id);
  if (ns) return ns;
  return (PRODUCTS.get(id)?.parts ?? []).map((x) => ({ ...x, img: Number(x.img) || 0 }));
}
export function partNumbers(id: number): string[] {
  const ns = netsuite().parts.get(id);
  return ns ? ns.map((q) => q.pn) : PRODUCTS.get(id)?.part_numbers ?? [];
}

/* ---------- NetSuite part numbers ---------- */

type NsItem = { id: number; pn: string; name: string; type: string; desc: string; sort: string; rrp: number | null; showRrp: boolean; img: string; img2: string; weburl: string; noBuy: boolean };
export type NsReport = { at: string; items: number; products: number; fromNetSuite: number[]; siteContentOnly: number[]; unplaced: { pn: string; name: string; weburl: string }[] };
type NsData = { parts: Map<number, Part[]>; prices: Map<number, number[]>; report: NsReport | null };

let NS: NsData | null = null;

/**
 * Builds each product's part number table from the NetSuite snapshot. An item belongs to a product when
 * its part number is already on that product, or its web URL (custitem_weburl) points at that product:
 * either /product-group/<group id> or a short link the site redirects to the product (e.g. /MX250A).
 * Products with no matching NetSuite items keep their current part numbers, and are listed in the report.
 */
function netsuite(): NsData {
  if (NS) return NS;
  NS = { parts: new Map(), prices: new Map(), report: null };
  let snap: { at: string; items: NsItem[] } | null = null;
  try {
    const f = join(process.cwd(), 'content', 'netsuite.json');
    if (existsSync(f)) snap = JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    snap = null;
  }
  if (!snap?.items?.length) return NS;

  const byPn = new Map<string, number[]>();
  const order = new Map<number, Map<string, number>>();
  const byGroup = new Map<string, number>();
  const byPath = new Map<string, number>();
  for (const r of products) {
    const id = Number(r.id);
    const o = new Map<string, number>();
    (r.parts ?? []).forEach((q, i) => {
      const k = q.pn.trim().toUpperCase();
      o.set(k, i);
      byPn.set(k, [...(byPn.get(k) ?? []), id]);
    });
    order.set(id, o);
    const g = str(r.meta.group_id);
    if (g) byGroup.set(g, id);
    byPath.set(r.path, id);
  }
  const redirects = site.redirects as unknown as Record<string, [string, number]>;
  const lowerRedirects = new Map(Object.entries(redirects).map(([k, v]) => [k.toLowerCase().replace(/\/$/, ''), v[0]]));
  const targetOf = (weburl: string): number | null => {
    const m = /\/product-group\/(\d+)/i.exec(weburl);
    if (m && byGroup.has(m[1])) return byGroup.get(m[1])!;
    const path = weburl.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0].toLowerCase().replace(/\/$/, '');
    if (!path) return null;
    const dest = lowerRedirects.get(path) ?? (byPath.has(path + '/') ? path + '/' : null);
    return dest ? byPath.get(dest) ?? null : null;
  };

  const oldImg = new Map<string, number>();
  for (const r of products) for (const q of r.parts ?? []) if (Number(q.img)) oldImg.set(q.pn.trim().toUpperCase(), Number(q.img));

  const lists = new Map<number, NsItem[]>();
  const unplaced: NsReport['unplaced'] = [];
  for (const it of snap.items) {
    const k = it.pn.toUpperCase();
    const targets = new Set(byPn.get(k) ?? []);
    const t = targetOf(it.weburl);
    if (t) targets.add(t);
    if (!targets.size) unplaced.push({ pn: it.pn, name: it.name, weburl: it.weburl });
    for (const id of targets) lists.set(id, [...(lists.get(id) ?? []), it]);
  }
  for (const [id, list] of lists) {
    const o = order.get(id)!;
    list.sort((a, b) => {
      const ia = o.get(a.pn.toUpperCase()), ib = o.get(b.pn.toUpperCase());
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return (Number(a.sort) || 0) - (Number(b.sort) || 0) || a.pn.localeCompare(b.pn);
    });
    const prices: number[] = [];
    NS.parts.set(
      id,
      list.map((it) => {
        const show = it.showRrp && it.rrp !== null && it.rrp > 0;
        if (show) prices.push(it.rrp!);
        return { pn: it.pn, d: txt(it.desc) || txt(it.name), p: show ? money(it.rrp!) : '', img: it.img || oldImg.get(it.pn.toUpperCase()) || 0 };
      }),
    );
    NS.prices.set(id, prices);
  }
  const ids = products.map((r) => Number(r.id));
  NS.report = {
    at: snap.at,
    items: snap.items.length,
    products: ids.length,
    fromNetSuite: ids.filter((id) => NS!.parts.has(id)),
    siteContentOnly: ids.filter((id) => !NS!.parts.has(id)),
    unplaced,
  };
  return NS;
}

/** What the NetSuite snapshot covered, for the check page and build log. */
export function netsuiteReport(): NsReport | null {
  return netsuite().report;
}

/** 7-year warranty mention anywhere in the product copy. */
export function has7yw(id: number): boolean {
  return !!PRODUCTS.get(id)?.has7yw;
}

/** Primary sub-category of a product. */
export function primarySub(id: number): Term | null {
  const r = PRODUCTS.get(id);
  if (!r) return null;
  const t = term(r.primary_sub);
  if (t && t.parent) return t;
  for (const c of r.cats ?? []) {
    const tt = term(c);
    if (tt && tt.parent) return tt;
  }
  return null;
}

/** Featured products (homepage), in their saved order. */
export function featuredIds(n = 4): number[] {
  return site.featured.map(Number).filter((id) => PRODUCTS.has(id)).slice(0, n);
}

export function upsells(id: number): number[] {
  return (PRODUCTS.get(id)?.upsells ?? []).map(Number);
}

export function productMeta(id: number) {
  const m = PRODUCTS.get(id)?.meta ?? {};
  return {
    more: str(m.more),
    specs: arr<[string, string]>(m.specs),
    faq: arr<Faq>(m.faq),
    downloads: arr<[string, string] | string>(m.downloads),
    videos: arr<string>(m.videos),
    reviews: arr<Review>(m.reviews),
    rsum: str(m.rsum),
    reviewLink: str(m.review_link),
    origName: str(m.orig_name),
    homeReview: m.home_review == null || m.home_review === '' ? null : Number(m.home_review),
    metaTitle: str(m.meta_title),
    metaDesc: str(m.meta_desc),
  };
}

/* ---------- Comparisons ---------- */

export function compareIds(c: { meta: Record<string, unknown> }): number[] {
  return arr<number>(c.meta.ids).map(Number);
}

export function comparesForProduct(pid: number) {
  return compares.filter((c) => compareIds(c).includes(pid));
}

export function comparesForTerm(t: Term) {
  const ids = t.parent ? prodsIn(t) : topItems(t);
  return compares.filter((c) => compareIds(c).some((x) => ids.includes(x)));
}

/* ---------- Search ---------- */

type IdxRow = { n: string; hay: string; sh: string; u: string; i: number; s: string; f: string; d: number };
let IDX: Map<number, IdxRow> | null = null;

export function searchIndex(): Map<number, IdxRow> {
  if (IDX) return IDX;
  IDX = new Map();
  for (const id of allProductIds()) {
    const x = p(id);
    if (!x) continue;
    const pns = partNumbers(id);
    const m = productMeta(id);
    IDX.set(id, {
      n: x.name,
      hay: [x.name, m.origName, x.aka, x.blurb, x.brand, pns.join(' ')].join(' ').toLowerCase(),
      sh: (x.name + ' ' + pns.join(' ')).toLowerCase(),
      u: x.url,
      i: x.img,
      s: x.series,
      f: x.from ? money(x.from) : '',
      d: x.date,
    });
  }
  return IDX;
}

/** Product IDs matching every word of the query (all products when empty, newest 24 for "new"). */
export function searchProducts(ql: string): number[] {
  const idx = searchIndex();
  const words = ql.split(/\s+/).filter(Boolean);
  if (ql === 'new') {
    return [...idx.keys()].sort((a, b) => idx.get(b)!.d - idx.get(a)!.d || b - a).slice(0, 24);
  }
  const res: number[] = [];
  for (const [id, x] of idx) {
    if (words.every((w) => x.hay.includes(w))) res.push(id);
  }
  if (ql !== '') {
    const pos = new Map(res.map((id, i) => [id, i]));
    res.sort((a, b) => {
      const ia = idx.get(a)!.n.toLowerCase().includes(ql) ? 1 : 0;
      const ib = idx.get(b)!.n.toLowerCase().includes(ql) ? 1 : 0;
      return ib - ia || pos.get(a)! - pos.get(b)!;
    });
  }
  return res;
}
