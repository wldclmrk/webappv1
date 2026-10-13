import { Shell } from '@/components/Shell';
import { compareIndexHtml } from '@/lib/pages/content';
import { seo, toMetadata } from '@/lib/seo';
import { pageUrl } from '@/lib/util';

const SEO = seo({ t: 'Compare Weldclass Models | Side-by-side Specs', url: pageUrl('compare') });
export const metadata = toMetadata(SEO);

export default function ComparePage() {
  return <Shell html={compareIndexHtml()} seo={SEO} />;
}
