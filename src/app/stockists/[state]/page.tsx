import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { STATES } from '@/lib/blocks';
import { stockistsHtml, stockistsSeo } from '@/lib/pages/content';
import { toMetadata } from '@/lib/seo';

type Props = { params: Promise<{ state: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(STATES).map((s) => ({ state: s.toLowerCase() }));
}

export async function generateMetadata({ params }: Props) {
  return toMetadata(stockistsSeo((await params).state.toUpperCase()));
}

export default async function StatePage({ params }: Props) {
  const st = (await params).state.toUpperCase();
  if (!STATES[st]) notFound();
  return <Shell html={stockistsHtml(st)} seo={stockistsSeo(st)} />;
}
