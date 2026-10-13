import { Shell } from '@/components/Shell';
import { dealerHtml, pageSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = pageSeo('register');
export const metadata = toMetadata(SEO);

export default function DealerPage() {
  return <Shell html={dealerHtml('register')} seo={SEO} />;
}
