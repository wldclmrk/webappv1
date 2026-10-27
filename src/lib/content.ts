/**
 * Site content, stored as JSON in /content/*.json.
 *
 * Products and categories are read through ./catalogue.ts, which is the only place that should
 * change when product data moves to NetSuite. Everything else (articles, pages, stockists,
 * comparisons, site copy) stays as JSON in this repository and is edited in GitHub.
 */
import siteJson from '@content/site.json';
import categoriesJson from '@content/categories.json';
import productsJson from '@content/products.json';
import postsJson from '@content/posts.json';
import pagesJson from '@content/pages.json';
import comparesJson from '@content/compares.json';
import stockistsJson from '@content/stockists.json';
import mediaJson from '@content/media.json';

export type Faq = { q: string; a: string };
export type Review = { n: string; s?: string; r: number; d?: string; c: string };

/** An image: [file path under /media, width, height]. */
export type MediaSize = [string, number, number];
export type Media = { f: string; w: number; h: number; alt: string; s: Record<string, MediaSize> };

/** One part number row. img is a media ID from the site's own images, or a full image URL (from NetSuite). */
export type Part = { pn: string; d: string; p: string; img: number | string };

export type ProductRecord = {
  id: number;
  slug: string;
  path: string;
  name: string;
  type: string;
  sku: string;
  description: string;
  short: string;
  img: number;
  gallery: number[];
  brand: string;
  series: string;
  pulse: boolean;
  prices: number[];
  from: number | null;
  parts: Part[];
  part_numbers: string[];
  cats: number[];
  primary_sub: number;
  upsells: number[];
  featured: boolean;
  menu_order: number;
  date: string;
  modified: string;
  has7yw: boolean;
  meta: {
    summary?: string;
    who?: string;
    aka?: string;
    more?: string;
    orig_name?: string;
    specs?: [string, string][] | string;
    faq?: Faq[] | string;
    videos?: string[] | string;
    downloads?: ([string, string] | string)[] | string;
    reviews?: Review[] | string;
    review_count?: string | number;
    rating?: string | number;
    review_link?: string;
    rsum?: string;
    kw?: string[] | string;
    home_review?: string | number | null;
    meta_title?: string;
    meta_desc?: string;
    [k: string]: unknown;
  };
};

export type TermRecord = {
  id: number;
  slug: string;
  name: string;
  parent: number;
  desc: string;
  order: number;
  label: string;
  band: string;
  tile: string;
  sub: string;
  h1: string;
  img: number;
  subs: number[];
  items: number[];
  path: string;
  meta: {
    intro?: string;
    guide?: string;
    faq?: Faq[] | string;
    seo_h1?: string;
    meta_title?: string;
    meta_desc?: string;
    [k: string]: unknown;
  };
};

export type PostRecord = {
  id: number;
  type: string;
  slug: string;
  path: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  modified: string;
  parent: number;
  order: number;
  cats: { id: number; name: string; slug: string }[];
  tags: string[];
  img: number;
  template: string;
  meta: Record<string, unknown>;
};

/** Stockist: [name, street, suburb, state, postcode, phone, lat, lng, website, active, country]. */
export type Stockist = [string, string, string, string, string, string, number, number, string, number, string];

export const site = siteJson as unknown as {
  name: string;
  description: string;
  mods: Record<string, string>;
  page_urls: Record<string, string>;
  redirects: Record<string, [string, number]>;
  featured: number[];
};
export const categories = categoriesJson as unknown as { tops: number[]; terms: TermRecord[] };
export const products = productsJson as unknown as ProductRecord[];
export const posts = postsJson as unknown as PostRecord[];
export const pages = pagesJson as unknown as PostRecord[];
export const compares = comparesJson as unknown as PostRecord[];
export const stockists = stockistsJson as unknown as Stockist[];
export const media = mediaJson as unknown as Record<string, Media>;

/** Read an array-valued field that may be stored as an array or as a JSON string. */
export function arr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string' && v.trim()) {
    try {
      const d = JSON.parse(v);
      return Array.isArray(d) ? (d as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function str(v: unknown): string {
  return v == null ? '' : String(v);
}
