import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { allTerms, termByPath } from '@/lib/catalogue';
import { categoryHtml, categorySeo } from '@/lib/pages/category';
import { toMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allTerms().map((t) => ({ slug: t.path.split('/').filter(Boolean).slice(1) }));
}

async function find(params: Props['params']) {
  const { slug } = await params;
  return termByPath('/category/' + slug.join('/') + '/');
}

export async function generateMetadata({ params }: Props) {
  const t = await find(params);
  return t ? toMetadata(categorySeo(t)) : {};
}

export default async function CategoryPage({ params }: Props) {
  const t = await find(params);
  if (!t) notFound();
  const { html, curTop } = categoryHtml(t);
  return <Shell html={html} curTop={curTop} seo={categorySeo(t)} />;
}
