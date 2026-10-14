import { go } from '@/lib/portal/http';

/** Replaced by /api/portal/signin/ (password) and /api/portal/reset/ (emailed link). Kept so old forms land somewhere useful. */
export function POST(req: Request) {
  return go(req, '/login/');
}
