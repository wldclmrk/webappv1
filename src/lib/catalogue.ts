/**
 * Catalogue data layer: categories, products, part numbers and search.
 *
 * This is the seam for NetSuite. Pages only use the functions exported here, so product data can
 * later come from NetSuite (at build time, or with incremental revalidation) by changing this file
 * and ./content.ts, without touching the page templates.
 */
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
  return products.map((x) => Number(x.id)).sort((a, b) => a - b);
}

/** Part numbers: SKU, description, RRP and thumbnail per variation. */
export function parts(id: number): Part[] {
  return (PRODUCTS.get(id)?.parts ?? []).map((x) => ({ ...x, img: Number(x.img) || 0 }));
}
export function partNumbers(id: number): string[] {
  return PRODUCTS.get(id)?.part_numbers ?? [];
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
