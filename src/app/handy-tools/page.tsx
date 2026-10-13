import { Shell } from '@/components/Shell';
import { handyToolsHtml, pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = pageSeo('handy-tools');
export const metadata = toMetadata(SEO);

export default function HandyToolsPage() {
  return <Shell html={handyToolsHtml()} seo={SEO} />;
}
