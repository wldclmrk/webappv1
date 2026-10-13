import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { compares } from '@/lib/content';
import { compareBySlug, compareHtml, compareSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return compares.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props) {
  const c = compareBySlug((await params).slug);
  return c ? toMetadata(compareSeo(c)) : {};
}

export default async function CompareDetail({ params }: Props) {
  const c = compareBySlug((await params).slug);
  if (!c) notFound();
  return <Shell html={compareHtml(c)} seo={compareSeo(c)} />;
}
