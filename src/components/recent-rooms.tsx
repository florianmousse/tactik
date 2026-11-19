'use client';
import { useEffect, useState } from 'react';
import type { RoomView } from '@/game/room';
import { summarizeRoom, type RecentRoomSummary } from '@/lib/recent-rooms';
import { hasLostRoomAccess } from '@/lib/room-connection';

export function RecentRooms({
  codes,
  signedIn,
  busy,
  load,
  resume,
}: {
  codes: string[];
  signedIn: boolean;
  busy: boolean;
  load: (code: string) => Promise<RoomView>;
  resume: (code: string) => void;
}) {
  const [entries, setEntries] = useState<Record<string, RecentRoomSummary | string>>({});
  const [revision, setRevision] = useState(0);
  const key = codes.join(',');
  useEffect(() => {
    setEntries({});
    if (!signedIn) return;
    let cancelled = false;
    let running = false;
    async function refresh() {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      for (const code of key.split(',').filter(Boolean)) {
        if (cancelled) break;
        let entry: RecentRoomSummary | string;
        try {
          entry = summarizeRoom(await load(code));
        } catch (error) {
          entry = hasLostRoomAccess(error)
            ? 'Partie expirée ou accès perdu.'
            : 'Informations indisponibles. Réessayez dans un instant.';
        }
        if (!cancelled) setEntries((previous) => ({ ...previous, [code]: entry }));
      }
      running = false;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, signedIn, load, revision]);
  return (
    <section className="recent-rooms" aria-label="Mes parties récentes">
      <h2>Mes parties récentes</h2>
      <button disabled={!signedIn || busy} onClick={() => setRevision((value) => value + 1)}>
        Actualiser les parties
      </button>
      {codes.map((code) => {
        const entry = entries[code];
        const summary = typeof entry === 'object' ? entry : null;
        return (
          <article className="recent-room" key={code}>
            <strong>
              {summary
                ? `${summary.players.slice(0, 2).join(', ')}${summary.players.length > 2 ? ` + ${summary.players.length - 2}` : ''}`
                : `Partie ${code}`}
            </strong>
            <p className={summary?.finished ? 'recent-room-result' : ''}>
              {summary?.status ??
                (typeof entry === 'string'
                  ? entry
                  : signedIn
                    ? 'Chargement des informations...'
                    : "Connectez-vous avec votre session d'origine.")}
            </p>
            <details>
              <summary>Détails de la partie</summary>
              {summary && (
                <>
                  <p>{summary.players.join(', ')}</p>
                  <p>
                    {summary.count}/{summary.capacity} joueurs ·{' '}
                    {summary.jokers ? 'Avec Joker' : 'Sans Joker'}
                    {summary.round ? ` · Donne ${summary.round}` : ''}
                  </p>
                  <p>
                    Vous : {summary.me}
                    {summary.partner ? ` · Coéquipier : ${summary.partner}` : ''}
                  </p>
                </>
              )}
              <small>Code : {code}</small>
            </details>
            <button disabled={busy || !signedIn} onClick={() => resume(code)}>
              {summary?.finished ? 'Voir le résultat' : 'Reprendre'}
            </button>
          </article>
        );
      })}
      {!signedIn && (
        <p className="error-text">
          Utilisez le navigateur et le profil d'origine pour retrouver votre place.
        </p>
      )}
    </section>
  );
}
