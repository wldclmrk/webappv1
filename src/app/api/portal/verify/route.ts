import { go } from '@/lib/portal/http';

/** Old one-click sign-in links (replaced by passwords) now go to the password reset page. */
export function GET(req: Request) {
  return go(req, '/forgot/?expired=1');
}
