import { Shell } from '@/components/Shell';
import { pageSeo, searchHtml } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<{ q?: string; cat?: string; pg?: string }> };

export async function generateMetadata({ searchParams }: Props) {
  const q = String((await searchParams).q ?? '').trim();
  return toMetadata(pageSeo('search', { t: (q ? 'Search: ' + q : 'All products') + ' | Weldclass' }));
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = String(sp.q ?? '').slice(0, 100);
  const cat = String(sp.cat ?? 'all').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'all';
  const pg = Number(sp.pg) || 1;
  return <Shell html={searchHtml(q, cat, pg)} seo={pageSeo('search')} />;
}
