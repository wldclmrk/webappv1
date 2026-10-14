/** Small response helpers for the portal routes. */
export function go(req: Request, path: string, cookie?: string): Response {
  const headers = new Headers({ Location: new URL(path, req.url).toString(), 'Cache-Control': 'no-store' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}
