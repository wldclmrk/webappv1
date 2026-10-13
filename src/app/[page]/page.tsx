import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { pages, str } from '@/lib/content';
import { contentPageHtml, pageByKey, pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

/** Content pages: About, Contact, Warranty, Batch certificates, Catalogue, Careers. */
const CONTENT_KEYS = ['about', 'contact', 'warranty', 'batch', 'catalogue', 'careers'];

type Props = { params: Promise<{ page: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return pages.filter((x) => CONTENT_KEYS.includes(str(x.meta.page_key))).map((x) => ({ page: x.slug }));
}

function find(slug: string) {
  const pg = pages.find((x) => x.slug === slug);
  const key = pg ? str(pg.meta.page_key) : '';
  return pg && CONTENT_KEYS.includes(key) ? pageByKey(key) : null;
}

export async function generateMetadata({ params }: Props) {
  const pg = find((await params).page);
  return pg ? toMetadata(pageSeo(str(pg.meta.page_key), { url: pg.path })) : {};
}

export default async function ContentPage({ params }: Props) {
  const pg = find((await params).page);
  if (!pg) notFound();
  return <Shell html={contentPageHtml(pg)} seo={pageSeo(str(pg.meta.page_key), { url: pg.path })} />;
}
