import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { dealerHtml } from '@/lib/pages/content';
import { currentHash } from '@/lib/portal/db';
import { hashVersion, portalEnabled, readLink } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: { absolute: 'Set your password | Weldclass' }, robots: 'noindex, nofollow' };

/** Set or reset a dealer password from an emailed link. Dead or used links go back to the request form. */
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (!portalEnabled()) redirect('/login/');
  const { t } = await searchParams;
  const link = readLink(t);
  if (!link || hashVersion(await currentHash(link.e)) !== link.v) redirect('/forgot/?expired=1');
  return <Shell html={dealerHtml('set', t)} />;
}
