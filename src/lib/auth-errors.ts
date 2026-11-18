// Only documented error codes reach the UI, never raw Auth error payloads.
export function authErrorMessage(code?: string): string {
  switch (code) {
    case 'captcha_failed':
      return 'CAPTCHA refusé par Supabase. Relancer la vérification. Si le problème persiste, vérifier la clé secrète Turnstile dans Supabase Auth.';
    case 'anonymous_provider_disabled':
      return 'Les connexions anonymes sont désactivées dans Supabase Auth.';
    case 'signup_disabled':
      return 'La création de sessions est désactivée dans Supabase Auth.';
    case 'over_request_rate_limit':
      return 'Trop de connexions. Réessayer dans une minute.';
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'Session expirée. Recharger la page pour se reconnecter.';
    default:
      return 'Connexion Supabase impossible. Vérifier les clés publiques et la connexion réseau.';
  }
}
export function captchaErrorMessage(code: string): string {
  if (code === '110200')
    return 'Ce domaine doit être autorisé dans le widget Cloudflare Turnstile.';
  if (code === '110100' || code === '110110')
    return 'La clé publique Turnstile est invalide. Vérifier la configuration puis redéployer.';
  if (code === '200500')
    return 'Le CAPTCHA ne se charge pas. Autoriser challenges.cloudflare.com dans le navigateur.';
  return `Vérification CAPTCHA interrompue${/^\d{6}$/.test(code) ? ` (${code})` : ''}. Réessayer ou utiliser un autre navigateur.`;
}
