/** Small response helpers for the portal routes. */
export function go(req: Request, path: string, cookie?: string): Response {
  const headers = new Headers({ Location: new URL(path, req.url).toString(), 'Cache-Control': 'no-store' });
  if (cookie) {
    headers.append('Set-Cookie', cookie);
    // Keep the header's "Dealer portal" flag in step with the session cookie.
    headers.append('Set-Cookie', /Max-Age=0/.test(cookie) ? 'wc_portal=; Path=/; Secure; SameSite=Lax; Max-Age=0' : 'wc_portal=1; Path=/; Secure; SameSite=Lax; Max-Age=43200');
  }
  return new Response(null, { status: 303, headers });
}
