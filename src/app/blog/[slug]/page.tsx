import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { posts } from '@/lib/content';
import { articleHtml, articleSeo, postBySlug } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((x) => ({ slug: x.slug }));
}

export async function generateMetadata({ params }: Props) {
  const post = postBySlug((await params).slug);
  return post ? toMetadata(articleSeo(post)) : {};
}

export default async function ArticlePage({ params }: Props) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  return <Shell html={articleHtml(post)} seo={articleSeo(post)} />;
}
