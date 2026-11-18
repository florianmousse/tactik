'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import type { Session } from '@supabase/supabase-js';
import { createGame, discardHand, exchange, play, viewFor } from '@/game/engine';
import { pendingBot, stepBot } from '@/game/bots';
import type { Capacity, Game, Play, Move } from '@/game/types';
import type { RoomView, PublicRoom } from '@/game/room';
import type { Command } from '@/server/schema';
import { configurationIssue, onlineConfigured, supabase } from '@/lib/supabase';
import { authErrorMessage, captchaErrorMessage } from '@/lib/auth-errors';
import { ApiError, requestGame } from '@/lib/game-api';
import { Board, PALETTE, COLOR_NAMES } from './board';
import { TurnControls } from './turn-controls';
import { Chat } from './chat';

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export function GameApp() {
  const [local, setLocal] = useState<Game | null>(null),
    [room, setRoom] = useState<RoomView | null>(null);
  const [name, setName] = useState(''),
    [capacity, setCapacity] = useState<Capacity>(6),
    [jokers, setJokers] = useState(true),
    [code, setCode] = useState('');
  const [publicRoom, setPublicRoom] = useState(false),
    [publicRooms, setPublicRooms] = useState<PublicRoom[] | null>(null),
    [destinations, setDestinations] = useState<Move[]>([]);
  const interaction = useRef<{ piece: (id: string) => void; move: (move: Move) => void }>({
    piece: () => {},
    move: () => {},
  });
  const [tab, setTab] = useState<'create' | 'join'>('create'),
    [panel, setPanel] = useState<'log' | 'chat' | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [rules, setRules] = useState(false);
  const [captcha, setCaptcha] = useState<string>(),
    [captchaError, setCaptchaError] = useState(''),
    [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false),
    [authReady, setAuthReady] = useState(!onlineConfigured);
  const [selectedPiece, setSelectedPiece] = useState<string>(),
    [playable, setPlayable] = useState<string[]>([]),
    [zoom, setZoom] = useState(false);
  const captchaRef = useRef<TurnstileInstance>(null),
    captchaToken = useRef(captcha);
  captchaToken.current = captcha;
  const alive = useRef(true);
  const view = useMemo(
    () => (local ? viewFor(local, 'local-0') : (room?.game ?? null)),
    [local, room?.game],
  );
  const receive = useCallback(
    (next: RoomView) =>
      setRoom((current) => {
        if (!current || current.code !== next.code) return next;
        const messages = [
          ...new Map([...current.messages, ...next.messages].map((m) => [m.id, m])).values(),
        ]
          .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
          .slice(-50);
        return { ...(next.version >= current.version ? next : current), messages };
      }),
    [],
  );
  const api = useCallback(async <T extends Command>(command: T, authenticate = false) => {
    const client = supabase();
    let {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession();
    if (sessionError) throw new Error(authErrorMessage(sessionError.code));
    if (!session && authenticate) {
      if (siteKey && !captchaToken.current)
        throw new Error('Terminer la vérification CAPTCHA avant de continuer.');
      const result = await client.auth.signInAnonymously({
        options: { captchaToken: captchaToken.current },
      });
      captchaRef.current?.reset();
      setCaptcha(undefined);
      if (result.error) throw new Error(authErrorMessage(result.error.code));
      session = result.data.session;
    }
    if (!session) throw new Error('Session absente. Rejoindre le salon pour se connecter.');
    return requestGame(command, session);
  }, []);
  const synchronize = useCallback(
    async (roomCode: string) => {
      try {
        const next = await api({ type: 'sync', code: roomCode });
        if (alive.current) receive(next);
      } catch (e) {
        if (alive.current) {
          setError((e as Error).message);
          if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
            setRoom(null);
            history.replaceState(null, '', location.pathname);
          }
        }
      }
    },
    [api, receive],
  );
  useEffect(() => {
    alive.current = true;
    const invitation = new URLSearchParams(location.search).get('salon');
    if (invitation && /^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/i.test(invitation)) {
      setCode(invitation.toUpperCase());
      setTab('join');
    }
    if (!onlineConfigured)
      return () => {
        alive.current = false;
      };
    const client = supabase();
    void client.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!alive.current) return;
        setSignedIn(Boolean(session));
        setAuthReady(true);
        if (error) setError(authErrorMessage(error.code));
        if (session && invitation && /^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/i.test(invitation)) {
          try {
            const next = await requestGame(
              { type: 'sync', code: invitation.toUpperCase() },
              session,
            );
            if (alive.current) receive(next);
          } catch (e) {
            if (alive.current && (!(e instanceof ApiError) || e.status !== 403))
              setError((e as Error).message);
          }
        }
      })
      .catch(() => {
        if (alive.current) {
          setAuthReady(true);
          setError('Supabase inaccessible. Vérifier la connexion réseau.');
        }
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session: Session | null) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      alive.current = false;
      subscription.unsubscribe();
    };
  }, [receive]);
  useEffect(() => {
    if (!room || local) return;
    const client = supabase(),
      roomCode = room.code;
    const channel = client
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_events',
          filter: `room_code=eq.${roomCode}`,
        },
        () => void synchronize(roomCode),
      )
      .subscribe();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void synchronize(roomCode);
    }, 15000);
    const focus = () => void synchronize(roomCode);
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      void client.removeChannel(channel);
    };
  }, [room?.code, Boolean(local), synchronize]);
  useEffect(() => {
    if (local && pendingBot(local) >= 0) {
      const timer = setTimeout(() => setLocal((g) => (g ? stepBot(g, Math.random) : g)), 650);
      return () => clearTimeout(timer);
    }
  }, [local]);
  useEffect(() => {
    if (local || !room?.game || pendingBot(room.game) < 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api({ type: 'bot-tick', code: room.code, version: room.version })
        .then((next) => {
          if (!cancelled) receive(next);
        })
        .catch(async (e) => {
          if (cancelled) return;
          if (e instanceof ApiError && e.status === 409) await synchronize(room.code);
          else setError((e as Error).message);
        });
    }, 850);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room?.version, room?.code, Boolean(local), api, receive, synchronize]);
  async function run(command: Exclude<Command, { type: 'list' }>): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      const next = await api(command, command.type === 'create' || command.type === 'join');
      receive(next);
      if (command.type === 'create' || command.type === 'join') {
        const address = new URL(location.href);
        address.searchParams.set('salon', next.code);
        history.replaceState(null, '', address);
        setPanel(null);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (room) void synchronize(room.code);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function solo() {
    setLocal(
      createGame(
        Array.from({ length: capacity }, (_, i) => ({
          id: `local-${i}`,
          name: i === 0 ? name.trim().slice(0, 24) || 'Vous' : `Bot ${i}`,
          bot: i > 0,
        })),
        Math.random,
        { jokers },
      ),
    );
    setError('');
    setPanel('log');
  }
  function localAction(action: () => Game) {
    try {
      setLocal(action());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function submitPlay(action: Play) {
    if (local) localAction(() => play(local, 0, action, Math.random));
    else if (room) void run({ type: 'play', code: room.code, version: room.version, play: action });
  }
  function submitExchange(cardIndex: number) {
    if (local) localAction(() => exchange(local, 0, cardIndex));
    else if (room)
      void run({ type: 'exchange', code: room.code, version: room.version, cardIndex });
  }
  function submitDiscard() {
    if (local) localAction(() => discardHand(local, 0, Math.random));
    else if (room) void run({ type: 'discard-hand', code: room.code, version: room.version });
  }
  async function invite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/?salon=${room.code}`);
      setNotice('Lien copié.');
    } catch {
      setNotice(`Code : ${room.code}`);
    }
  }
  async function fillBots() {
    if (!room) return;
    setBusy(true);
    setError('');
    let next = room;
    try {
      while (next.people.length < next.capacity) {
        next = await api({ type: 'bot-add', code: next.code, version: next.version });
        receive(next);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const captchaRequired = Boolean(siteKey) && !signedIn;
  const connectionDisabled =
    busy || !onlineConfigured || !authReady || (captchaRequired && !captcha);
  return (
    <main className={view ? 'app playing' : 'app'}>
      <header className="topbar">
        <a href="/" className="brand">
          TAC<span>✳</span>TIK
        </a>
        <nav>
          {view && (
            <span className="game-meta">
              {local ? 'Solo avec bots' : room?.code} · Donne {view.round}
            </span>
          )}
          {room && !local && <button onClick={invite}>Inviter</button>}
          <button onClick={() => setRules(!rules)} aria-expanded={rules}>
            Règles
          </button>
          {local && (
            <button
              onClick={() => {
                setLocal(null);
                setPlayable([]);
              }}
            >
              Quitter
            </button>
          )}
        </nav>
      </header>
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button aria-label="Fermer l'erreur" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      {rules && (
        <section className="rules-panel">
          <button className="close" onClick={() => setRules(false)} aria-label="Fermer les règles">
            ×
          </button>
          <h2>Règles</h2>
          <p>
            1 et 10 : avancer ou démarrer. -4 : reculer. ⇄ : permuter. 7 : répartir les pas entre
            des pions de même couleur, chacun une seule fois, en capturant sur le passage.
          </p>
          <p>
            Un pieu bloque le passage et ne peut pas être capturé. Dans la maison, aucun
            dépassement. Après avoir rentré ses pions, on joue ceux du partenaire.
          </p>
          <p>
            Joker : remplace une carte au choix. Un par paquet, deux à 8 joueurs. La valeur choisie
            est vérifiée comme une carte normale.
          </p>
          <p>
            Défausse complète : uniquement si tous les pions contrôlés sont en réserve et sans 1, 10
            ou Joker. Un pion bloqué sur le parcours interdit cette option.
          </p>
        </section>
      )}
      {!room && !local && (
        <section className="lobby-layout">
          <div className="setup-panel">
            <h1>Nouvelle partie</h1>
            <div className="tabs">
              <button
                aria-pressed={tab === 'create'}
                className={tab === 'create' ? 'selected' : ''}
                onClick={() => setTab('create')}
              >
                Créer
              </button>
              <button
                aria-pressed={tab === 'join'}
                className={tab === 'join' ? 'selected' : ''}
                onClick={() => setTab('join')}
              >
                Rejoindre
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  tab === 'create'
                    ? { type: 'create', name, capacity, jokers, public: publicRoom }
                    : { type: 'join', name, code },
                );
              }}
            >
              <label>
                Pseudo
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  required
                  autoComplete="nickname"
                  placeholder="Pseudo"
                />
              </label>
              {tab === 'create' ? (
                <>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={publicRoom}
                      onChange={(e) => setPublicRoom(e.target.checked)}
                    />
                    Salon public - visible dans la liste
                  </label>
                  <fieldset>
                    <legend>Joueurs</legend>
                    <div className="capacity">
                      {([2, 3, 4, 6, 8] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={capacity === n}
                          className={capacity === n ? 'selected' : ''}
                          onClick={() => setCapacity(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={jokers}
                      onChange={(e) => setJokers(e.target.checked)}
                    />
                    1 Joker par paquet
                  </label>
                  <p className="muted">
                    {capacity < 4
                      ? 'Individuel, deux couleurs par joueur'
                      : `${capacity / 2} équipes de deux`}
                    . {capacity === 8 ? 'Deux paquets.' : ''}
                  </p>
                </>
              ) : (
                <label>
                  Code du salon
                  <input
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 12),
                      )
                    }
                    minLength={8}
                    maxLength={12}
                    required
                    placeholder="8 caractères"
                  />
                </label>
              )}
              {onlineConfigured && captchaRequired && (
                <div className="captcha-box">
                  <Turnstile
                    ref={captchaRef}
                    siteKey={siteKey!}
                    onLoadScript={() => setCaptchaLoaded(true)}
                    onSuccess={(token) => {
                      setCaptcha(token);
                      setCaptchaError('');
                    }}
                    onExpire={() => {
                      setCaptcha(undefined);
                      setCaptchaError('Vérification expirée. Relancer le CAPTCHA.');
                    }}
                    onError={(value) => {
                      setCaptcha(undefined);
                      setCaptchaError(captchaErrorMessage(value));
                    }}
                    onTimeout={() => {
                      setCaptcha(undefined);
                      setCaptchaError('Vérification trop longue. Réessayer.');
                    }}
                    options={{ theme: 'light', size: 'flexible' }}
                  />
                  {!captcha && !captchaError && (
                    <p className="muted">
                      {captchaLoaded
                        ? 'Vérification CAPTCHA en cours...'
                        : 'Chargement du CAPTCHA...'}
                    </p>
                  )}
                  {captchaError && (
                    <p role="alert" className="error-text">
                      {captchaError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCaptcha(undefined);
                      setCaptchaError('');
                      captchaRef.current?.reset();
                    }}
                  >
                    Relancer le CAPTCHA
                  </button>
                </div>
              )}
              <button className="primary wide" disabled={connectionDisabled}>
                {busy ? 'Connexion...' : tab === 'create' ? 'Créer le salon' : 'Rejoindre le salon'}
              </button>
              {!onlineConfigured && <p className="error-text">{configurationIssue}</p>}
            </form>
            <section className="public-rooms" aria-label="Salons publics">
              <h2>Salons publics</h2>
              <button
                disabled={connectionDisabled}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    setPublicRooms((await api({ type: 'list' }, true)).rooms);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {publicRooms ? 'Actualiser la liste' : 'Voir les parties ouvertes'}
              </button>
              {publicRooms?.length === 0 && <p>Aucun salon disponible pour le moment.</p>}
              {publicRooms?.map((item) => (
                <div className="public-room" key={item.code}>
                  <span>
                    <b>{item.name}</b> - {item.players}/{item.capacity} joueurs
                    <br />
                    {item.jokers ? 'Avec Joker' : 'Sans Joker'}
                  </span>
                  <button
                    disabled={connectionDisabled || !name.trim()}
                    onClick={() => run({ type: 'join', code: item.code, name })}
                  >
                    Rejoindre
                  </button>
                </div>
              ))}
              {publicRooms && !name.trim() && (
                <p className="muted">Renseignez votre pseudo pour rejoindre.</p>
              )}
            </section>
            <div className="solo-entry">
              <button className="secondary wide" onClick={solo}>
                Jouer contre {capacity - 1} bots
              </button>
              <span className="muted">Local, sans connexion. {capacity} joueurs.</span>
            </div>
          </div>
          <div className="setup-preview">
            <Board
              game={viewFor(
                createGame(
                  Array.from({ length: capacity }, (_, i) => ({
                    id: `preview-${i}`,
                    name: `Joueur ${i + 1}`,
                  })),
                  () => 0.5,
                  { jokers },
                ),
                'preview-0',
              )}
              playable={[]}
              onPiece={() => {}}
            />
            <p>
              {capacity === 8
                ? '4 panneaux'
                : capacity === 6 || capacity === 3
                  ? '3 panneaux'
                  : '2 panneaux'}{' '}
              · {capacity < 4 ? capacity * 2 : capacity} couleurs
            </p>
          </div>
        </section>
      )}
      {room && !view && (
        <section className="waiting-layout">
          <div className="setup-panel">
            <h1>Salon {room.code}</h1>
            <p>
              {room.people.length} / {room.capacity} joueurs ·{' '}
              {room.jokers ? 'Avec Joker' : 'Sans Joker'}
            </p>
            <div className="seats">
              {Array.from({ length: room.capacity }, (_, i) => (
                <div className="seat" key={i}>
                  <span>{i + 1}</span>
                  <b>{room.people[i]?.name ?? 'Place libre'}</b>
                  <small>{room.people[i]?.bot ? 'Bot' : room.people[i]?.me ? 'Vous' : ''}</small>
                  {room.host && i > 0 && room.people[i] && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run({
                          type: room.people[i].bot ? 'bot-remove' : 'kick',
                          code: room.code,
                          version: room.version,
                          seat: i,
                        })
                      }
                      aria-label={`Retirer ${room.people[i].name}`}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="muted">
              {room.capacity >= 4 ? 'Les places opposées forment une équipe.' : ''}
            </p>
            {room.host && (
              <div className="lobby-actions">
                <button
                  className="secondary"
                  disabled={busy || room.people.length === room.capacity}
                  onClick={fillBots}
                >
                  Compléter avec des bots
                </button>
                <button
                  className="primary"
                  disabled={busy || room.people.length !== room.capacity}
                  onClick={() => run({ type: 'start', code: room.code, version: room.version })}
                >
                  Commencer
                </button>
              </div>
            )}
            <button onClick={invite}>Copier le lien</button>
          </div>
          <div className="setup-panel">
            <h2>Chat du salon</h2>
            <Chat
              messages={room.messages}
              onSend={(id, text) => run({ type: 'chat', code: room.code, id, text })}
            />
          </div>
        </section>
      )}
      {view && (
        <div className="game-layout">
          <section className="table-area">
            <div className="team-identity">
              <b>Vous : {view.players[view.me].colors.map((c) => COLOR_NAMES[c]).join(' + ')}</b>
              <span>
                {view.players.length >= 4
                  ? `Equipe ${view.players[view.me].team + 1} avec ${view.players
                      .filter((p, i) => i !== view.me && p.team === view.players[view.me].team)
                      .map((p) => `${p.name} (${p.colors.map((c) => COLOR_NAMES[c]).join(', ')})`)
                      .join(', ')}`
                  : 'Vous contrôlez ces deux couleurs'}
              </span>
            </div>
            <div className="players">
              {view.players.map((p, i) => (
                <div
                  key={p.id}
                  className={`player ${view.phase === 'play' && view.turn === i ? 'current' : ''}`}
                >
                  <span className="color-dots">
                    {p.colors.map((c) => (
                      <i key={c} title={COLOR_NAMES[c]} style={{ background: PALETTE[c] }} />
                    ))}
                  </span>
                  <b>
                    {p.name}
                    {i === view.me ? ' (vous)' : ''}
                  </b>
                  <small>
                    {p.bot ? 'Bot · ' : ''}
                    {view.players.length >= 4 ? `Éq. ${p.team + 1} · ` : ''}
                    {view.handCounts[i]} cartes
                    {view.phase === 'exchange' && view.exchanged[i] ? ' ✓' : ''}
                  </small>
                </div>
              ))}
            </div>
            <div className={`board-stage ${zoom ? 'zoomed' : ''}`}>
              <Board
                game={view}
                selected={selectedPiece}
                playable={busy ? [] : playable}
                destinations={destinations}
                onMove={(move) => !busy && interaction.current.move(move)}
                onPiece={(id) => !busy && interaction.current.piece(id)}
              />
            </div>
            <div className="board-tools">
              <span>↻ Sens horaire · {view.deckCount} cartes en pioche</span>
              <button aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
                {zoom ? 'Ajuster le plateau' : 'Agrandir'}
              </button>
            </div>
          </section>
          <aside className="game-sidebar">
            <TurnControls
              view={view}
              busy={busy}
              selectedPiece={selectedPiece}
              onPiece={setSelectedPiece}
              onPlayable={setPlayable}
              onDestinations={setDestinations}
              interaction={interaction}
              onExchange={submitExchange}
              onPlay={submitPlay}
              onDiscardHand={submitDiscard}
            />
            <section className="session-panel">
              <div className="tabs">
                <button
                  className={panel === 'log' ? 'selected' : ''}
                  aria-pressed={panel === 'log'}
                  onClick={() => setPanel(panel === 'log' ? null : 'log')}
                  aria-expanded={panel === 'log'}
                >
                  Historique
                </button>
                {room && !local && (
                  <button
                    className={panel === 'chat' ? 'selected' : ''}
                    aria-pressed={panel === 'chat'}
                    onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
                    aria-expanded={panel === 'chat'}
                  >
                    {panel === 'chat' ? 'Fermer le chat' : `Chat (${room.messages.length})`}
                  </button>
                )}
              </div>
              {panel === 'chat' && room && !local ? (
                <Chat
                  messages={room.messages}
                  onSend={(id, text) => run({ type: 'chat', code: room.code, id, text })}
                />
              ) : panel === 'log' ? (
                <div className="journal">
                  {view.log.slice(0, 8).map((line, i) => (
                    <p key={`${i}-${line}`}>{line}</p>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
