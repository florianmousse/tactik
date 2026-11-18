export function publicConfigurationIssue(
  url: string | undefined,
  key: string | undefined,
): string | null {
  if (!url || !key) return 'Renseigner les variables publiques Supabase puis redéployer.';
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'supabase.com' ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    )
      return 'Utiliser Project URL (https://<référence>.supabase.co), pas le lien du tableau de bord Supabase.';
    if (!['https:', 'http:'].includes(parsed.protocol)) return 'URL Supabase invalide.';
  } catch {
    return 'URL Supabase invalide.';
  }
  return null;
}
