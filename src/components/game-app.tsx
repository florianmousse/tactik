'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { createGame, exchange, legalPlays, play, viewFor } from '@/game/engine';
import type { Card, Game, Move, View } from '@/game/types';
import type { RoomView } from '@/game/room';
import type { Command } from '@/server/schema';
import { onlineConfigured, supabase } from '@/lib/supabase';
import { Board, COLOR_NAMES, PALETTE } from './board';

const cardTitle = (c: Card) =>
  c === 'swap'
    ? 'Permuter'
    : c === 7
      ? 'Décomposer'
      : c === -4
        ? 'Reculer'
        : c === 1 || c === 10
          ? 'Avancer / sortir'
          : 'Avancer';
const cardSymbol = (c: Card) => (c === 'swap' ? '⇄' : c === 7 ? '7×1' : String(c));
const moveLabel = (m: Move) =>
  `${COLOR_NAMES[Number(m.piece[0])]} ${Number(m.piece[2]) + 1} · ${m.kind === 'start' ? 'Sortir de la réserve' : m.kind === 'swap' ? `Permuter avec ${COLOR_NAMES[Number(m.target[0])]} ${Number(m.target[2]) + 1}` : `${m.steps < 0 ? 'Reculer' : 'Avancer'} de ${Math.abs(m.steps)}${m.home ? ' vers la maison' : ''}`}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function useLocalGame() {
  const [local, setLocal] = useState<Game | null>(null);
  useEffect(() => {
    if (!local || local.phase === 'finished') return;
    const actor =
      local.phase === 'exchange'
        ? local.exchanges.findIndex((x, i) => i > 0 && x === null)
        : local.turn;
    if (actor <= 0) return;
    const timeout = setTimeout(
      () =>
        setLocal((current) => {
          if (!current) return current;
          if (current.phase === 'exchange') return exchange(current, actor, 0);
          const options = legalPlays(current, actor);
          const best = options.find((p) => p.moves.some((m) => m.kind === 'move' && m.home)) ??
            options.find((p) => p.moves.some((m) => m.kind === 'start')) ??
            options[Math.floor(Math.random() * options.length)] ?? { cardIndex: 0, moves: [] };
          return play(current, actor, best, Math.random);
        }),
      650,
    );
    return () => clearTimeout(timeout);
  }, [local]);
  return [local, setLocal] as const;
}
export function GameApp() {
  const [local, setLocal] = useLocalGame();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<2 | 3 | 4 | 6>(4);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [captcha, setCaptcha] = useState<string>();
  const captchaRef = useRef<TurnstileInstance>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string>();
  const [draft, setDraft] = useState<Move[]>([]);
  const [rules, setRules] = useState(false);
  const view: View | null = local ? viewFor(local, 'local-0') : (room?.game ?? null);
  const api = useCallback(
    async (command: Command, authenticate = false): Promise<RoomView> => {
      const client = supabase();
      let {
        data: { session },
      } = await client.auth.getSession();
      if (!session && authenticate) {
        const { data, error } = await client.auth.signInAnonymously({
          options: { captchaToken: captcha },
        });
        captchaRef.current?.reset();
        setCaptcha(undefined);
        if (error)
          throw new Error(
            'Connexion impossible. Vérifiez le CAPTCHA ou la configuration Supabase.',
          );
        session = data.session;
      }
      if (!session) throw new Error('Rejoignez le salon pour vous connecter.');
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(command),
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connexion interrompue.');
      return data;
    },
    [captcha],
  );
  const receive = useCallback(
    (next: RoomView) =>
      setRoom((current) =>
        !current || current.code !== next.code || next.version >= current.version ? next : current,
      ),
    [],
  );
  const synchronize = useCallback(
    async (roomCode: string) => {
      try {
        receive(await api({ type: 'sync', code: roomCode }));
        setError('');
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [api, receive],
  );
  useEffect(() => {
    const invitation = new URLSearchParams(window.location.search).get('salon');
    if (!invitation || !/^[A-F0-9]{12}$/i.test(invitation)) return;
    const roomCode = invitation.toUpperCase();
    setCode(roomCode);
    setTab('join');
    if (!onlineConfigured) return;
    const controller = new AbortController();
    void supabase()
      .auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session || controller.signal.aborted) return;
        const response = await fetch('/api/game', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type: 'sync', code: roomCode }),
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) receive(await response.json());
      })
      .catch(() => {
        /* The join form remains available after a failed automatic resume. */
      });
    return () => controller.abort();
  }, [receive]);
  useEffect(() => {
    if (!room || local) return;
    const roomCode = room.code;
    const client = supabase();
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
        () => {
          void synchronize(roomCode);
        },
      )
      .subscribe();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void synchronize(roomCode);
    }, 15000);
    const focus = () => {
      void synchronize(roomCode);
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      void client.removeChannel(channel);
    };
  }, [room?.code, local !== null, synchronize]); // Only reconnect when salon/session changes.
  const revision = local
    ? JSON.stringify([local.turn, local.hands[0], local.phase, local.exchanges])
    : room?.version;
  useEffect(() => {
    setSelectedCard(null);
    setSelectedPiece(undefined);
    setDraft([]);
  }, [revision]);
  async function run(command: Command) {
    setBusy(true);
    setError('');
    try {
      const next = await api(command, command.type === 'create' || command.type === 'join');
      receive(next);
      if (command.type === 'create' || command.type === 'join') {
        const address = new URL(window.location.href);
        address.searchParams.set('salon', next.code);
        window.history.replaceState(null, '', address);
      }
    } catch (e) {
      setError((e as Error).message);
      if (room) {
        try {
          receive(await api({ type: 'sync', code: room.code }));
        } catch {
          /* Keep original error */
        }
      }
    } finally {
      setBusy(false);
    }
  }
  const actions =
    view && selectedCard !== null
      ? view.options.filter(
          (p) => p.cardIndex === selectedCard && draft.every((m, i) => same(m, p.moves[i])),
        )
      : [];
  const nextMoves = [
    ...new Map(
      actions
        .filter((p) => p.moves.length > draft.length)
        .map((p) => {
          const m = p.moves[draft.length];
          return [JSON.stringify(m), m];
        }),
    ).values(),
  ];
  const playable = [...new Set(nextMoves.map((m) => m.piece))];
  const complete = actions.some((p) => p.moves.length === draft.length) && draft.length > 0;
  const discard = view?.phase === 'play' && view.turn === view.me && !view.options.length;
  function chooseCard(index: number) {
    setSelectedCard(index);
    setDraft([]);
    setSelectedPiece(undefined);
  }
  function addMove(m: Move) {
    setDraft([...draft, m]);
    setSelectedPiece(undefined);
  }
  async function submit() {
    if (!view || selectedCard === null) return;
    if (local) {
      try {
        setLocal(
          view.phase === 'exchange'
            ? exchange(local, 0, selectedCard)
            : play(local, 0, { cardIndex: selectedCard, moves: draft }, Math.random),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    } else if (room)
      await run(
        view.phase === 'exchange'
          ? { type: 'exchange', code: room.code, version: room.version, cardIndex: selectedCard }
          : {
              type: 'play',
              code: room.code,
              version: room.version,
              play: { cardIndex: selectedCard, moves: draft },
            },
      );
  }
  function demo() {
    setLocal(
      createGame(
        Array.from({ length: capacity }, (_, i) => ({
          id: `local-${i}`,
          name:
            i === 0
              ? name.trim().slice(0, 24) || 'Vous'
              : ['Alix', 'Camille', 'Lou', 'Sacha', 'Noa'][i - 1],
        })),
        Math.random,
      ),
    );
    setError('');
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?salon=${room!.code}`);
      setNotice('Lien d’invitation copié !');
    } catch {
      setNotice(`Code du salon : ${room!.code}`);
    }
  }
  return (
    <main>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Tactik accueil">
          tac<span>✳</span>tik<span className="brand-dot">.</span>
        </a>
        <div className="toplinks">
          <span className="eyebrow desktop">LE PLAISIR DE JOUER ENSEMBLE</span>
          <button className="quiet" onClick={() => setRules(!rules)} aria-expanded={rules}>
            Les règles <span>↗</span>
          </button>
        </div>
      </header>
      {rules && (
        <section className="rules-panel">
          <div>
            <span className="eyebrow">LE MÉMO DE LA TABLE</span>
            <h2>Quatre pions, un objectif.</h2>
            <p>
              Ramenez vos pions à la maison, puis aidez votre partenaire. Les places sont attribuées
              dans l’ordre d’arrivée ; les partenaires sont assis face à face.
            </p>
          </div>
          <div>
            <p>
              <b>1 et 10</b> : sortir un pieu ou avancer. <b>−4</b> : reculer. <b>⇄</b> : permuter.
            </p>
            <p>
              <b>7×1</b> : répartir 7 pas entre des pions de même couleur, chacun une seule fois.
              Tous les pions rencontrés sont mangés.
            </p>
            <p>
              Un pieu bloque tout le monde jusqu’à son premier déplacement. Dans la maison, aucun
              dépassement. Jouer est obligatoire si possible.
            </p>
            <p>
              À chaque donne, choisissez une carte à échanger. Elle n’est révélée au destinataire
              qu’une fois tous les choix faits.
            </p>
          </div>
          <button className="quiet" onClick={() => setRules(false)}>
            Fermer ×
          </button>
        </section>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Fermer la notification">
            ×
          </button>
        </div>
      )}
      {!view && !room ? (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-star">✳</span> LE JEU DE PLATEAU, À DISTANCE
              </div>
              <h1>
                À vous de
                <br />
                jouer <em>malin.</em>
              </h1>
              <p>
                Les cartes en main. Les amis autour.
                <br />
                Une course à la maison où tout peut changer.
              </p>
              <div className="hero-tags">
                <span>2 à 6 joueurs</span>
                <span>En équipes ou en solo</span>
                <span>100 % navigateur</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="decor-card decor-back">
                <span>tac✳tik</span>
              </div>
              <div className="decor-card decor-front">
                <b>
                  7<span>×1</span>
                </b>
                <span>
                  DÉCOMPOSER
                  <br />& ÉLIMINER
                </span>
                <div className="card-pips">
                  ● ● ●<br />● ● ●<br />●
                </div>
                <small>Un coup d’avance.</small>
              </div>
              <div className="wood-token token-green" />
              <div className="wood-token token-red" />
              <span className="art-note">
                La prochaine partie
                <br />
                commence ici. ⤴
              </span>
            </div>
          </section>
          <section className="welcome-grid">
            <div className="lobby-card">
              <div className="tabs" role="tablist" aria-label="Accès à une partie">
                <button
                  role="tab"
                  aria-selected={tab === 'create'}
                  className={tab === 'create' ? 'active' : ''}
                  onClick={() => setTab('create')}
                >
                  Créer une table
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'join'}
                  className={tab === 'join' ? 'active' : ''}
                  onClick={() => setTab('join')}
                >
                  Rejoindre des amis
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    tab === 'create'
                      ? { type: 'create', name, capacity }
                      : { type: 'join', name, code },
                  );
                }}
              >
                <label>
                  Votre pseudo
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={24}
                    required
                    placeholder="Comment vous appelle-t-on ?"
                    autoComplete="nickname"
                  />
                </label>
                {tab === 'create' ? (
                  <fieldset>
                    <legend>Combien serez-vous ?</legend>
                    <div className="capacity">
                      {([2, 3, 4, 6] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={capacity === n ? 'selected' : ''}
                          aria-pressed={capacity === n}
                          onClick={() => setCapacity(n)}
                        >
                          {n}
                          <small>{n < 4 ? 'solo' : 'équipes'}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <label>
                    Code de la table
                    <input
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-F0-9]/g, '')
                            .slice(0, 12),
                        )
                      }
                      minLength={12}
                      maxLength={12}
                      required
                      placeholder="12 caractères"
                      className="code-input"
                    />
                  </label>
                )}
                {onlineConfigured && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <Turnstile
                    ref={captchaRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={setCaptcha}
                    onExpire={() => setCaptcha(undefined)}
                    options={{ theme: 'light' }}
                  />
                )}
                <button className="primary wide" disabled={busy || !onlineConfigured}>
                  {busy ? 'Connexion…' : tab === 'create' ? 'Ouvrir la table →' : 'Prendre place →'}
                </button>
                <p className="form-note">
                  {onlineConfigured
                    ? 'Un pseudo suffit. Invitez vos amis avec un lien privé.'
                    : 'Le jeu en ligne sera disponible après la configuration Supabase.'}
                </p>
              </form>
            </div>
            <div className="intro-card">
              <span className="eyebrow">ON VOUS GARDE UNE PLACE</span>
              <h2>
                Simple à apprendre.
                <br />
                Difficile à lâcher.
              </h2>
              <div className="step">
                <span>01</span>
                <p>
                  <b>Rassemblez votre équipe</b>Une table privée, un lien à partager.
                </p>
              </div>
              <div className="step">
                <span>02</span>
                <p>
                  <b>Gardez vos cartes pour vous</b>Échangez, avancez, bloquez… surprenez.
                </p>
              </div>
              <div className="step">
                <span>03</span>
                <p>
                  <b>Rentrez à la maison</b>La victoire se construit à plusieurs.
                </p>
              </div>
              <button className="text-button" onClick={demo}>
                Essayer avec des joueurs automatiques <span>↗</span>
              </button>
              <small className="muted">
                Entraînement local · sans inscription · {capacity} joueurs
              </small>
            </div>
          </section>
        </>
      ) : !view && room ? (
        <section className="waiting">
          <span className="eyebrow">LA TABLE EST OUVERTE</span>
          <h1>
            Une place pour
            <br />
            <em>chaque ami.</em>
          </h1>
          <p>Partagez ce code et installez-vous.</p>
          <button className="room-code" onClick={copyInvite}>
            {room.code} <small>Copier le lien ↗</small>
          </button>
          <div className="seats">
            {Array.from({ length: room.capacity }, (_, i) => (
              <div key={i} className={room.people[i] ? 'seat filled' : 'seat'}>
                <span>{room.people[i] ? room.people[i].name[0].toUpperCase() : '+'}</span>
                <b>{room.people[i]?.name || 'Place libre'}</b>
                <small>
                  {room.people[i]?.me ? 'Vous' : room.people[i] ? 'Prêt à jouer' : 'En attente'}
                </small>
              </div>
            ))}
          </div>
          <p>
            {room.people.length} / {room.capacity} joueurs présents
          </p>
          {room.host ? (
            <button
              className="primary"
              disabled={busy || room.people.length !== room.capacity}
              onClick={() => run({ type: 'start', code: room.code, version: room.version })}
            >
              Tout le monde est là, on joue →
            </button>
          ) : (
            <p>L’hôte lancera la partie lorsque tout le monde sera là.</p>
          )}
          <p className="muted">Gardez ce code pour retrouver la partie dans ce navigateur.</p>
        </section>
      ) : (
        view && (
          <>
            <div className="table-heading">
              <div>
                <span className="eyebrow">
                  {local ? 'ENTRAÎNEMENT · JOUEURS AUTOMATIQUES' : `TABLE PRIVÉE · ${room?.code}`}
                </span>
                <h1>
                  {view.phase === 'finished'
                    ? 'Bien joué !'
                    : view.phase === 'exchange'
                      ? 'Un échange, et on joue.'
                      : view.turn === view.me
                        ? 'À vous de jouer.'
                        : `${view.players[view.turn].name} réfléchit…`}
                </h1>
              </div>
              {local ? (
                <button className="quiet" onClick={() => setLocal(null)}>
                  Quitter l’entraînement ↗
                </button>
              ) : (
                <button className="quiet" onClick={copyInvite}>
                  Inviter / copier le lien ↗
                </button>
              )}
            </div>
            <div className="game-layout">
              <section className="table-area">
                <div className="players">
                  {view.players.map((p, i) => (
                    <div
                      key={p.id}
                      className={`player ${view.phase === 'play' && view.turn === i ? 'current' : ''}`}
                    >
                      <span
                        className="avatar"
                        style={{
                          background: PALETTE[p.colors[0]],
                          color: p.colors[0] === 5 ? '#333' : '#fff',
                        }}
                      >
                        {p.name[0]}
                      </span>
                      <div>
                        <b>
                          {p.name}
                          {i === view.me ? ' (vous)' : ''}
                        </b>
                        <small>
                          {view.players.length > 3 ? `Équipe ${p.team + 1} · ` : ''}
                          {view.handCounts[i]} cartes{' '}
                          {view.phase === 'exchange' && view.exchanged[i] ? '· ✓' : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
                <Board
                  game={view}
                  selected={selectedPiece}
                  playable={playable}
                  onPiece={setSelectedPiece}
                />
                <div className="board-footer">
                  <span>↻ Sens horaire</span>
                  <span>
                    Donne {view.round} · {view.deckCount} cartes dans la pioche
                  </span>
                </div>
              </section>
              <aside className="game-sidebar">
                <section className="action-panel">
                  <span className="eyebrow">
                    {view.phase === 'exchange' ? 'L’ÉCHANGE' : 'VOTRE PROCHAIN COUP'}
                  </span>
                  <h2>
                    {view.phase === 'finished'
                      ? `Victoire de ${view.players.length > 3 ? `l’équipe ${view.winner! + 1}` : view.players.find((p) => p.team === view.winner)?.name}`
                      : view.phase === 'exchange'
                        ? view.exchanged[view.me]
                          ? 'Carte envoyée.'
                          : 'Choisissez une carte.'
                        : view.turn !== view.me
                          ? 'À chacun son tour.'
                          : selectedCard === null
                            ? 'À vous de choisir.'
                            : complete
                              ? 'Prêt à jouer ?'
                              : discard
                                ? 'Aucun coup possible.'
                                : 'Choisissez un pion.'}
                  </h2>
                  <p className="muted">
                    {view.phase === 'exchange'
                      ? 'La carte reçue apparaîtra quand tout le monde aura fait son choix.'
                      : view.turn !== view.me
                        ? 'Préparez votre prochain coup pendant que les autres jouent.'
                        : selectedCard === null
                          ? 'Sélectionnez une carte dans votre main. Les pions jouables seront entourés.'
                          : discard
                            ? 'Sélectionnez une carte à défausser.'
                            : 'Cliquez sur un pion du plateau, puis choisissez son déplacement.'}
                  </p>
                  {draft.length > 0 && (
                    <ol className="draft">
                      {draft.map((m, i) => (
                        <li key={i}>{moveLabel(m)}</li>
                      ))}
                    </ol>
                  )}
                  {selectedCard !== null &&
                    view.hand[selectedCard] === 7 &&
                    view.phase === 'play' && (
                      <p className="seven-counter">
                        {draft.reduce((n, m) => n + (m.kind === 'move' ? m.steps : 0), 0)} / 7 pas
                        préparés
                      </p>
                    )}
                  {selectedPiece && !complete && (
                    <div className="move-options">
                      {nextMoves
                        .filter((m) => m.piece === selectedPiece)
                        .map((m) => (
                          <button key={JSON.stringify(m)} onClick={() => addMove(m)}>
                            {moveLabel(m)}
                          </button>
                        ))}
                    </div>
                  )}
                  {!selectedPiece && playable.length > 0 && !complete && (
                    <div className="piece-choices">
                      {playable.map((id) => (
                        <button key={id} onClick={() => setSelectedPiece(id)}>
                          <i style={{ background: PALETTE[Number(id[0])] }} />
                          {COLOR_NAMES[Number(id[0])]} {Number(id[2]) + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  {draft.length > 0 && (
                    <button
                      className="quiet"
                      onClick={() => {
                        setDraft([]);
                        setSelectedPiece(undefined);
                      }}
                    >
                      Recomposer le coup ↺
                    </button>
                  )}
                  {view.phase !== 'finished' && (
                    <button
                      className="primary wide"
                      onClick={submit}
                      disabled={
                        busy ||
                        selectedCard === null ||
                        (view.phase === 'exchange'
                          ? view.exchanged[view.me]
                          : !(complete || discard))
                      }
                    >
                      {busy
                        ? 'Envoi…'
                        : view.phase === 'exchange'
                          ? 'Échanger cette carte →'
                          : discard
                            ? 'Défausser cette carte'
                            : 'Jouer ce coup →'}
                    </button>
                  )}
                </section>
                <section className="journal">
                  <span className="eyebrow">AUTOUR DE LA TABLE</span>
                  {view.log.slice(0, 6).map((line, i) => (
                    <p key={`${i}-${line}`} className={i === 0 ? 'latest' : ''}>
                      {line}
                    </p>
                  ))}
                </section>
              </aside>
            </div>
            <section className="hand-area">
              <div className="hand-label">
                <span className="eyebrow">VOTRE MAIN</span>
                <p>
                  {view.phase === 'exchange'
                    ? 'Une carte à offrir.'
                    : 'À chaque carte, une possibilité.'}
                </p>
                <span className="private-label">◈ Visible par vous uniquement</span>
              </div>
              <div className="hand">
                {view.hand.map((c, i) => (
                  <button
                    key={`${i}-${c}`}
                    className={`playing-card ${selectedCard === i ? 'chosen' : ''}`}
                    disabled={
                      view.phase === 'finished' ||
                      (view.phase === 'exchange' ? view.exchanged[view.me] : view.turn !== view.me)
                    }
                    onClick={() => chooseCard(i)}
                    aria-pressed={selectedCard === i}
                    aria-label={`Carte ${cardSymbol(c)}, ${cardTitle(c)}`}
                  >
                    <small>{cardSymbol(c)}</small>
                    <strong>{cardSymbol(c)}</strong>
                    <span>{cardTitle(c)}</span>
                    <small className="bottom-number">{cardSymbol(c)}</small>
                  </button>
                ))}
              </div>
            </section>
          </>
        )
      )}
      <footer>
        <span className="brand small">
          tac<span>✳</span>tik.
        </span>
        <span>Les bonnes parties rapprochent.</span>
        <span>Adaptation indépendante · TAC-TIK</span>
      </footer>
    </main>
  );
}
