import { go } from '@/lib/portal/http';
import { clearCookie } from '@/lib/portal/session';

export async function POST(req: Request) {
  return go(req, '/login/?out=1', clearCookie());
}
