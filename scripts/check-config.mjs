// Read-only diagnostics. Never print keys, tokens, users, room states or Auth payloads.
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const report = {
  publicConfig: Boolean(url && publicKey),
  serverKey: Boolean(secret),
  rateSecretLengthValid: (process.env.RATE_LIMIT_SECRET?.length ?? 0) >= 32,
  originMatchesPublished:
    process.env.APP_ORIGIN?.trim().replace(/\/$/, '') === 'https://tactik-bigflom.vercel.app',
  turnstileSiteKey: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
};
if (url && publicKey) {
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: publicKey },
      signal: AbortSignal.timeout(15000),
    });
    report.authStatus = r.status;
    const data = await r.json();
    report.authSettingsAccessible = r.ok;
    report.anonymousSignInEnabled = Boolean(data.external?.anonymous_users);
    report.newSessionsAllowed = !data.disable_signup;
  } catch {
    report.authSettingsAccessible = false;
  }
}
if (url && secret) {
  const db = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const [table, columns] of [
    ['game_rooms', 'code'],
    ['room_members', 'room_code'],
    ['room_events', 'chat_revision'],
    ['rate_limits', 'key'],
    ['room_messages', 'id'],
  ]) {
    try {
      const { error } = await db.from(table).select(columns).limit(0);
      report[table] = error ? `unavailable (${error.code})` : 'available';
    } catch {
      report[table] = 'network failure';
    }
  }
}
try {
  const response = await fetch('https://tactik-bigflom.vercel.app/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://tactik-bigflom.vercel.app' },
    body: JSON.stringify({ type: 'sync', code: '000000000000' }),
    signal: AbortSignal.timeout(15000),
  });
  report.publishedUnauthenticatedStatus = response.status;
} catch {
  report.publishedUnauthenticatedStatus = 'network failure';
}
console.log(JSON.stringify(report, null, 2));
