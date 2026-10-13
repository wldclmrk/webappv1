/**
 * SEO and answer-engine metadata: title, description, robots, canonical, Open Graph, Twitter and
 * JSON-LD (Organization, WebSite, Product, BreadcrumbList, FAQPage, CollectionPage, Article, ItemList).
 */
import type { Metadata } from 'next';
import type { Faq } from './content';
import { asset, abs, imgUrl, mod, pageUrl } from './util';

export type Seo = {
  t: string;
  d: string;
  img: string;
  type: 'website' | 'article' | 'product';
  url: string;
  robots: string;
  graph: Record<string, unknown>[];
};

export function seo(partial: Partial<Seo> = {}): Seo {
  return {
    t: 'Weldclass | Welding Machines, Consumables & Safety Gear',
    d: 'Australian-owned since 1979. Weldclass welding machines, wire, rods, helmets, safety gear and ALLCLEAR fume control, sold through 1,000+ distributors nationwide.',
    img: asset('hero-fury165.jpg'),
    type: 'website',
    url: '/',
    robots: 'index, follow, max-image-preview:large',
    graph: [],
    ...partial,
  };
}

export function crumbLd(items: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x[0], item: abs(x[1]) })),
  };
}

export function faqLd(f: Faq[]) {
  return { '@type': 'FAQPage', mainEntity: f.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) };
}

/** Next.js metadata for a page. */
export function toMetadata(c: Seo): Metadata {
  const noindex = process.env.NOINDEX === 'true';
  const robots = noindex ? 'noindex, nofollow' : c.robots;
  const image = abs(c.img || imgUrl('hero-fury165.jpg'));
  return {
    title: { absolute: c.t },
    description: c.d,
    robots,
    alternates: { canonical: abs(c.url) },
    openGraph: {
      title: c.t,
      description: c.d,
      type: c.type === 'product' ? 'website' : c.type,
      url: abs(c.url),
      images: [image],
      siteName: 'Weldclass',
      locale: 'en_AU',
    },
    twitter: { card: 'summary_large_image', title: c.t, description: c.d, images: [image] },
    other: c.type === 'product' ? { 'og:type': 'product' } : undefined,
  };
}

/** The JSON-LD graph for a page (site-wide nodes plus the page's own). */
export function jsonLd(c: Seo): string {
  const site = abs('/');
  const org = {
    '@type': ['Organization', 'LocalBusiness'],
    '@id': site + '#org',
    name: 'Weldclass',
    legalName: 'Weldclass Welding Products',
    url: site,
    logo: abs(asset('logo-blue.png')),
    foundingDate: '1979',
    telephone: '+61 2 6764 9590',
    description: 'Australian-owned supplier of welding machines, consumables, safety equipment and ALLCLEAR fume control, sold through more than 1,000 distributors across Australia and the South Pacific.',
    address: { '@type': 'PostalAddress', streetAddress: '6 East West Place', addressLocality: 'Tamworth', addressRegion: 'NSW', postalCode: '2340', addressCountry: 'AU' },
    areaServed: ['AU', 'FJ', 'NC', 'PG', 'WS', 'VU'],
    sameAs: ['social_fb', 'social_ig', 'social_yt', 'social_in', 'social_tt'].map(mod).filter(Boolean),
  };
  const website = {
    '@type': 'WebSite',
    '@id': site + '#site',
    url: site,
    name: 'Weldclass',
    publisher: { '@id': site + '#org' },
    potentialAction: { '@type': 'SearchAction', target: abs(pageUrl('search')) + '?q={query}', 'query-input': 'required name=query' },
  };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, website, ...c.graph] }).replace(/</g, '\\u003c');
}
