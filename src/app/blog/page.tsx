import { Shell } from '@/components/Shell';
import { blogHtml, pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = pageSeo('blog');
export const metadata = toMetadata(SEO);

export default function BlogPage() {
  return <Shell html={blogHtml()} seo={SEO} />;
}
