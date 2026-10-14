import { PortalPage, portalMetadata } from '@/lib/portal/page';

export const dynamic = 'force-dynamic';
export const metadata = portalMetadata;

export default function Page() {
  return <PortalPage tab="overview" />;
}
