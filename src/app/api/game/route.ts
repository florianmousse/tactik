import { NextResponse } from 'next/server';
import { commandSchema } from '@/server/schema';
import { admin, dispatch, HttpError, limit } from '@/server/store';
import { configuredOrigin } from '@/server/origin';
export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Origin' };
  try {
    const expected =
      configuredOrigin(process.env.APP_ORIGIN) ||
      (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : '');
    if (!expected || request.headers.get('origin') !== expected)
      throw new HttpError(
        403,
        'Origine refusée. APP_ORIGIN doit correspondre au domaine utilisé, puis le site doit être redéployé.',
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new HttpError(415, 'Format JSON requis.');
    const db = admin();
    // Vercel overwrites x-vercel-forwarded-for. Never trust a caller's arbitrary x-forwarded-for.
    const ip = process.env.VERCEL
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
      : 'local';
    await limit(`ip:${ip}`, 240);
    const token = request.headers
      .get('authorization')
      ?.match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/)?.[1];
    if (!token) throw new HttpError(401, 'Connexion requise.');
    const {
      data: { user },
      error,
    } = await db.auth.getUser(token);
    if (error || !user) throw new HttpError(401, 'Session expirée. Reconnectez-vous.');
    await limit(`user:${user.id}`, 90);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Requête vide.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new HttpError(413, 'Requête trop volumineuse.');
      }
      chunks.push(value);
    }
    let json: unknown;
    try {
      json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'JSON invalide.');
    }
    const parsed = commandSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError(400, 'Requête invalide. Vérifiez le pseudo et le code du salon.');
    return NextResponse.json(await dispatch(parsed.data, user.id), { headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    // Do not log tokens, request bodies, hands, IPs, or database errors.
    if (status === 500) console.error('game_api_unexpected_error');
    return NextResponse.json(
      { error: e instanceof HttpError ? e.message : 'Erreur interne. Réessayez.' },
      { status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) } },
    );
  }
}
