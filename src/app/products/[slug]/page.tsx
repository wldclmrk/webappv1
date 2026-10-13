import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { allProductIds, p, productBySlug } from '@/lib/catalogue';
import { productHtml, productSeo } from '@/lib/pages/product';
import { toMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allProductIds().map((id) => ({ slug: p(id)!.rec.slug }));
}

export async function generateMetadata({ params }: Props) {
  const x = productBySlug((await params).slug);
  return x ? toMetadata(productSeo(x)) : {};
}

export default async function ProductPage({ params }: Props) {
  const x = productBySlug((await params).slug);
  if (!x) notFound();
  const { html, curTop } = productHtml(x);
  return <Shell html={html} curTop={curTop} seo={productSeo(x)} />;
}
