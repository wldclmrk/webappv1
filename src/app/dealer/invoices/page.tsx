import { PortalPage, portalMetadata } from '@/lib/portal/page';

export const dynamic = 'force-dynamic';
export const metadata = portalMetadata;

export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  return <PortalPage tab="invoices" show={show === 'open' ? 'open' : ''} />;
}
