import { Shell } from '@/components/Shell';
import { stockistsHtml, stockistsSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

const SEO = stockistsSeo();
export const metadata = toMetadata(SEO);

export default function StockistsPage() {
  return <Shell html={stockistsHtml()} seo={SEO} />;
}
