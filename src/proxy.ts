import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  let connect = '';
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co');
    connect = `${u.origin} wss://${u.host}`;
  } catch {
    /* Fail closed */
  }
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ''} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${connect} https://challenges.cloudflare.com ${dev ? 'ws://localhost:* ws://127.0.0.1:*' : ''}; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
