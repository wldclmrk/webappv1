import { Shell } from '@/components/Shell';
import { dealerHtml, pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = pageSeo('login');
export const metadata = toMetadata(SEO);

export default function DealerPage() {
  return <Shell html={dealerHtml('login')} seo={SEO} />;
}
