import { stockists } from '@/lib/content';

/** Stockist list for the Where to buy finder. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(stockists, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
