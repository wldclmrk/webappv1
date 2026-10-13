import { Shell } from '@/components/Shell';
import { pageSeo, whereToBuyHtml } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<{ product?: string; pc?: string }> };

const SEO = pageSeo('where-to-buy');
export const metadata = toMetadata(SEO);

export default async function WhereToBuyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const product = Number(sp.product) || 0;
  const q = typeof sp.pc === 'string' && sp.pc.trim() ? sp.pc.trim().slice(0, 80) : 'Tamworth NSW 2340';
  return <Shell html={whereToBuyHtml(product, q)} seo={SEO} />;
}
