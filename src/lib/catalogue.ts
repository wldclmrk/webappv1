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
import { autoParagraphs, money, txt } from './util';

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
  return (sub?.items ?? []).map(Number).filter((id) => PRODUCTS.has(id));
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

/* The products the site shows: built from NetSuite when the build has a snapshot, otherwise the site content. */
const SOURCE = buildSource();
const PRODUCTS = new Map<number, ProductRecord>(SOURCE.list.map((p) => [Number(p.id), p]));
const PRODUCT_BY_SLUG = new Map<string, ProductRecord>(SOURCE.list.map((p) => [p.slug, p]));

/** Every product record the site shows, in content order. */
export function productRecords(): ProductRecord[] {
  return SOURCE.list;
}

export type P = {
  id: number;
  rec: ProductRecord;
  name: string;
  url: string;
  img: number | string;
  gallery: (number | string)[];
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
    img: typeof r.img === 'string' ? r.img : Number(r.img) || 0,
    gallery: (r.gallery ?? []).map((g) => (typeof g === 'string' ? g : Number(g))),
    blurb: txt(r.short),
    brand: r.brand,
    series: r.series,
    summary: str(r.meta.summary),
    who: str(r.meta.who),
    aka: str(r.meta.aka),
    rating: str(r.meta.rating),
    review_cnt: Number(r.meta.review_count) || 0,
    prices: (r.prices ?? []).map(Number),
    from: r.from == null ? null : Number(r.from),
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
  return SOURCE.list.map((x) => Number(x.id)).sort((a, b) => a - b);
}

/** Part numbers: SKU, description, RRP and thumbnail per variation. */
export function parts(id: number): Part[] {
  return (PRODUCTS.get(id)?.parts ?? []).map((x) => ({ ...x, img: typeof x.img === 'string' ? x.img : Number(x.img) || 0 }));
}
export function partNumbers(id: number): string[] {
  return PRODUCTS.get(id)?.part_numbers ?? [];
}

/** What the NetSuite snapshot covered, for the check page and build log. */
export function netsuiteReport(): NsReport | null {
  return SOURCE.report;
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
  return (PRODUCTS.get(id)?.upsells ?? []).map(Number).filter((x) => PRODUCTS.has(x));
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
  return arr<number>(c.meta.ids).map(Number).filter((id) => PRODUCTS.has(id));
}

export function comparesForProduct(pid: number) {
  return compares.filter((c) => compareIds(c).includes(pid));
}

export function comparesForTerm(t: Term) {
  const ids = t.parent ? prodsIn(t) : topItems(t);
  return compares.filter((c) => compareIds(c).some((x) => ids.includes(x)));
}

/* ---------- Search ---------- */

type IdxRow = { n: string; hay: string; sh: string; u: string; i: number | string; s: string; f: string; d: number };
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

/* ---------- NetSuite source ---------- */

type NsItem = {
  id: number; pn: string; name: string; type: string; desc: string; sort: string; rrp: number | null; showRrp: boolean; img: string; img2: string; weburl: string; noBuy: boolean;
  primary?: boolean; title?: string; shortHtml?: string; blurb?: string; features?: string; f1?: string; f2?: string; f3?: string; downloads?: string;
  seoTitle?: string; seoDesc?: string; disclaimer?: string; brand?: string; w7?: boolean; related?: string;
};
export type NsReport = { at: string; items: number; products: number; fromNetSuite: number[]; siteContentOnly: number[]; unplaced: { pn: string; name: string; weburl: string }[]; warnings: string[] };
type Source = { list: ProductRecord[]; report: NsReport | null };

function readSnapshot(): { at: string; items: NsItem[]; warnings?: string[] } | null {
  try {
    const f = join(process.cwd(), 'content', 'netsuite.json');
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  } catch {
    return null;
  }
}

/** Links in a NetSuite HTML field ("<a href=...>label</a>") as [label, url] download rows. */
function links(html: string): [string, string][] {
  return [...String(html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => [txt(m[2]), m[1]] as [string, string]).filter((l) => l[0]);
}

/**
 * NetSuite-only product records. A product page exists only when NetSuite has website items for it
 * (custitemshowproductonweb ticked). An item belongs to a page when its part number is on that page,
 * or its web URL (custitem_weburl) points at it: /product-group/<group id>, or a short link the site
 * redirects to the product (e.g. /MX250A). All content comes from NetSuite; the only things kept from
 * the site are the page address and which category the product sits in.
 */
function buildSource(): Source {
  const snap = readSnapshot();
  if (!snap?.items?.length) return { list: products, report: null };

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

  const lists = new Map<number, NsItem[]>();
  const unplaced: NsReport['unplaced'] = [];
  for (const it of snap.items) {
    const targets = new Set(byPn.get(it.pn.toUpperCase()) ?? []);
    const t = targetOf(it.weburl);
    if (t) targets.add(t);
    if (!targets.size) unplaced.push({ pn: it.pn, name: it.name, weburl: it.weburl });
    for (const id of targets) lists.set(id, [...(lists.get(id) ?? []), it]);
  }

  const build = (r: ProductRecord, items: NsItem[], o: Map<string, number>): ProductRecord => {
    items.sort((a, b) => {
      const ia = o.get(a.pn.toUpperCase()), ib = o.get(b.pn.toUpperCase());
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return (Number(a.sort) || 0) - (Number(b.sort) || 0) || a.pn.localeCompare(b.pn);
    });
    const main = items.find((it) => it.primary) ?? items[0];
    const prices: number[] = [];
    const rows: Part[] = items.map((it) => {
      const show = it.showRrp && it.rrp !== null && it.rrp > 0;
      if (show) prices.push(it.rrp!);
      return { pn: it.pn, d: txt(it.desc) || txt(it.name), p: show ? money(it.rrp!) : '', img: it.img || 0 };
    });
    const gallery = [...new Set([main.img, main.img2, ...items.map((it) => it.img)].filter(Boolean))].slice(0, 6) as string[];
    const feats = [main.f1, main.f2, main.f3].filter((f): f is string => !!f && f.trim() !== '');
    const more =
      (main.features && txt(main.features) ? main.features : feats.length ? '<p><strong>KEY FEATURES:</strong></p><ul>' + feats.map((f) => '<li>' + f + '</li>').join('') + '</ul>' : '') +
      (main.disclaimer ? '<p>*' + main.disclaimer.replace(/^\*+/, '') + '</p>' : '');
    const name = txt(main.title) || txt(main.name) || main.pn;
    return {
      ...r,
      name,
      type: main.type,
      sku: main.pn,
      description: main.blurb ? autoParagraphs(main.blurb) : main.shortHtml ?? '',
      short: main.shortHtml || main.blurb || '',
      img: gallery[0] ?? 0,
      gallery: gallery.slice(1),
      brand: main.brand ?? '',
      series: '',
      pulse: /pulse/i.test(name),
      prices,
      from: prices.length ? Math.min(...prices) : null,
      parts: rows,
      part_numbers: rows.map((q) => q.pn),
      upsells: [],
      has7yw: items.some((it) => it.w7),
      meta: {
        group_id: r.meta.group_id,
        related: main.related ?? '',
        more,
        downloads: links(main.downloads ?? ''),
        meta_title: main.seoTitle ?? '',
        meta_desc: main.seoDesc ?? '',
      },
    };
  };

  const list: ProductRecord[] = [];
  for (const r of products) {
    const items = lists.get(Number(r.id));
    if (items?.length) list.push(build(r, items, order.get(Number(r.id))!));
  }

  // NetSuite items with no page on the site get new pages, one per web URL (or per item when it has none).
  const groups = new Map<string, NsItem[]>();
  for (const u of unplaced) {
    const it = snap.items.find((x) => x.pn === u.pn)!;
    const key = it.weburl ? it.weburl.replace(/^https?:\/\/[^/]+/i, '').toLowerCase().replace(/\/$/, '') : 'item:' + it.pn;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const slugs = new Set(products.map((r) => r.slug));
  const created: number[] = [];
  for (const items of groups.values()) {
    const main = items.find((it) => it.primary) ?? items[0];
    let slug = (txt(main.title) || txt(main.name) || main.pn).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item-' + main.id;
    for (let n = 2; slugs.has(slug); n++) slug = slug.replace(/-\d+$/, '') + '-' + n;
    slugs.add(slug);
    const id = 1_000_000 + main.id;
    const base = {
      id, slug, path: '/products/' + slug + '/', name: '', type: '', sku: '', description: '', short: '', img: 0, gallery: [], brand: '', series: '', pulse: false,
      prices: [], from: null, parts: [], part_numbers: [], cats: [], primary_sub: 0, upsells: [], featured: false, menu_order: 0,
      date: snap.at, modified: snap.at, has7yw: false, meta: {},
    } as unknown as ProductRecord;
    list.push(build(base, items, new Map()));
    created.push(id);
  }

  // Related products: NetSuite "group IDs" (custitem_weldclass_grp_id, e.g. 141.52) -> page.
  const byGrp = new Map<string, number>();
  for (const r of list) for (const q of lists.get(Number(r.id)) ?? []) if (q.sort) byGrp.set(String(q.sort).trim(), Number(r.id));
  for (const r of list) {
    if (created.includes(Number(r.id))) for (const pn of r.part_numbers) {
      const it = snap.items.find((x) => x.pn === pn);
      if (it?.sort) byGrp.set(String(it.sort).trim(), Number(r.id));
    }
  }
  for (const r of list) {
    r.upsells = [...new Set(String(r.meta.related ?? '').split(',').map((x) => byGrp.get(x.trim())).filter((x): x is number => !!x && x !== Number(r.id)))];
  }

  const ids = products.map((r) => Number(r.id));
  const shown = new Set(list.map((r) => Number(r.id)));
  return {
    list,
    report: {
      at: snap.at,
      items: snap.items.length,
      products: ids.length,
      fromNetSuite: list.map((r) => Number(r.id)),
      siteContentOnly: ids.filter((id) => !shown.has(id)),
      unplaced: unplaced.filter((u) => !list.some((r) => r.part_numbers.includes(u.pn))),
      warnings: snap.warnings ?? [],
    },
  };
}
