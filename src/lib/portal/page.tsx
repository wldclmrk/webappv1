import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { portalHtml, type PortalTab } from '@/lib/pages/portal';
import { COOKIE, portalEnabled, readSession } from './session';

export const portalMetadata: Metadata = { title: { absolute: 'Dealer portal | Weldclass' }, robots: 'noindex, nofollow' };

/** Shared server render for the dealer portal pages: no session, no page. */
export async function PortalPage({ tab, show = '' }: { tab: PortalTab; show?: string }) {
  if (!portalEnabled()) redirect('/login/');
  const s = readSession((await cookies()).get(COOKIE)?.value);
  if (!s) redirect('/login/?expired=1');
  return <Shell html={await portalHtml(s, tab, show)} />;
}
