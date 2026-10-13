import { searchIndex, subs, termUrl, tops } from '@/lib/catalogue';
import { imgUrl } from '@/lib/util';

/** Compact index for the instant header search suggestions. Built once per deployment. */
export const dynamic = 'force-static';

export function GET() {
  const out: { p: unknown[]; c: unknown[] } = { p: [], c: [] };
  for (const x of searchIndex().values()) out.p.push([x.n, x.sh, x.u, imgUrl(x.i, 'thumbnail'), x.s, x.f]);
  for (const t of tops()) for (const s of subs(t)) out.c.push([s.name, termUrl(s), s.img ? imgUrl(s.img, 'thumbnail') : '']);
  return Response.json(out, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
