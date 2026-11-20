'use client';
import { useEffect, useState } from 'react';
import { supabase, onlineConfigured } from '@/lib/supabase';
import type { AdminCommand, AdminResult, AdminRoom } from '@/server/admin-access';
import { cardSymbol } from '@/game/labels';
export function AdminPanel() {
  const [identity, setIdentity] = useState('');
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [bots, setBots] = useState<{
    code: string;
    hands: NonNullable<AdminResult['bots']>;
  } | null>(null);
  const [offset, setOffset] = useState(0),
    [more, setMore] = useState(false);
  const [target, setTarget] = useState<AdminRoom | null>(null),
    [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!onlineConfigured) return;
    void supabase()
      .auth.getSession()
      .then(({ data }) => setIdentity(data.session?.user.id ?? ''));
    const subscription = supabase().auth.onAuthStateChange((event, session) => {
      setIdentity(session?.user.id ?? '');
      if (event === 'SIGNED_OUT') {
        setBots(null);
        setRooms([]);
        setTarget(null);
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  async function request(command: AdminCommand): Promise<AdminResult> {
    const session = (await supabase().auth.getSession())?.data.session;
    if (!session)
      throw new Error(
        "Connectez-vous à un salon depuis l'accueil pour créer votre session, puis revenez ici.",
      );
    setIdentity(session.user.id);
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    const result: AdminResult & { error?: string } = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Requête refusée.');
    return result;
  }
  async function run(command: AdminCommand) {
    setBusy(true);
    setMessage('');
    setBots(null);
    try {
      const result = await request(command);
      if (command.type === 'list') {
        setRooms(result.rooms ?? []);
        setOffset(command.offset);
        setMore(Boolean(result.more));
        setTarget(null);
      }
      if (command.type === 'inspect') setBots({ code: command.code, hands: result.bots ?? [] });
      if (command.type === 'delete') {
        setRooms((items) => items.filter((r) => r.code !== command.code));
        setTarget(null);
        setMessage('Salon et données associées supprimés.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Connexion interrompue. Actualisez avant toute nouvelle action.',
      );
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app admin-panel">
      <a href="/">Retour au jeu</a>
      <h1>Administration</h1>
      <p>
        Accès réservé aux UUID configurés côté serveur. Les mains humaines et la pioche restent
        masquées.
      </p>
      <p>
        UUID de cette session : <code>{identity || 'Aucune session active'}</code>
      </p>
      <button disabled={busy} onClick={() => void run({ type: 'list', offset: 0 })}>
        Charger / actualiser les salons
      </button>
      <p role="status">{busy ? 'Chargement...' : message}</p>
      <div className="admin-rooms">
        {rooms.map((room) => (
          <section key={room.code} className="setup-panel">
            <h2>{room.code}</h2>
            <p>
              {
                (
                  {
                    waiting: 'En attente',
                    exchange: 'Échange',
                    play: 'En cours',
                    finished: 'Terminée',
                  } as Record<string, string>
                )[room.phase]
              }{' '}
              - {room.players.length}/{room.capacity} joueurs
            </p>
            <p>{room.players.join(', ')}</p>
            <p>Expiration : {new Date(room.expiresAt).toLocaleString('fr-FR')}</p>
            <button disabled={busy} onClick={() => void run({ type: 'inspect', code: room.code })}>
              Voir les cartes des bots
            </button>{' '}
            <button
              disabled={busy}
              onClick={() => {
                setTarget(room);
                setConfirmation('');
              }}
            >
              Supprimer ce salon
            </button>
            {target?.code === room.code && (
              <div>
                <p>
                  Suppression définitive de cette partie, de son chat et de ses accès, même en
                  cours. Saisissez {room.code} pour confirmer.
                </p>
                <label>
                  Code du salon
                  <input
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <button
                  disabled={busy || confirmation !== room.code}
                  onClick={() =>
                    void run({ type: 'delete', code: room.code, version: room.version })
                  }
                >
                  Confirmer la suppression définitive
                </button>
                <button disabled={busy} onClick={() => setTarget(null)}>
                  Annuler
                </button>
              </div>
            )}
            {bots?.code === room.code && (
              <div>
                <p>Instantané à la dernière consultation.</p>
                {bots.hands.length ? (
                  bots.hands.map((bot, i) => (
                    <p key={i}>
                      <b>{bot.name}</b> : {bot.cards.map(cardSymbol).join(', ') || 'Main vide'}
                    </p>
                  ))
                ) : (
                  <p>Aucune main de bot disponible.</p>
                )}
                <button onClick={() => setBots(null)}>Masquer les cartes</button>
              </div>
            )}
          </section>
        ))}
      </div>
      <button
        disabled={busy || offset === 0}
        onClick={() => void run({ type: 'list', offset: Math.max(0, offset - 30) })}
      >
        Page précédente
      </button>{' '}
      <button
        disabled={busy || !more}
        onClick={() => void run({ type: 'list', offset: offset + 30 })}
      >
        Page suivante
      </button>
    </main>
  );
}
