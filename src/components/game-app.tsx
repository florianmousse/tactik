'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import type { Session } from '@supabase/supabase-js';
import { createGame, discardHand, exchange, play, simulateMoves, viewFor } from '@/game/engine';
import { pendingBot, stepBot } from '@/game/bots';
import type { Capacity, Game, Play, Move } from '@/game/types';
import type { RoomView, PublicRoom } from '@/game/room';
import type { Command } from '@/server/schema';
import { configurationIssue, onlineConfigured, supabase } from '@/lib/supabase';
import { authErrorMessage, captchaErrorMessage } from '@/lib/auth-errors';
import { ApiError, requestGame } from '@/lib/game-api';
import { Board } from './board';
import { TurnControls } from './turn-controls';
import { MobileChat } from './mobile-chat';
import { Chat } from './chat';
import { RecentRooms } from './recent-rooms';
import { HistoryPanel } from './history-panel';
import { BotHands } from './bot-hands';
import { unreadMessages } from '@/lib/chat-unread';
import { PlayerList, PRESENCE_LABELS } from './player-list';
import { parseRecentRooms, rememberRoom } from '@/lib/recent-rooms';
import { canRetryAfterRefresh, hasLostRoomAccess } from '@/lib/room-connection';

const BOT_DELAY_MS = 1200;
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
  const [tab, setTab] = useState<'create' | 'join' | 'public' | 'recent' | 'solo'>('public');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setMobile(query.matches);
      setMobileChatOpen(false);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const latest = room?.messages.at(-1);
  const previous = useRef<{ code?: string; id?: string } | null>(null);
  const [previewId, setPreviewId] = useState<string>();
  useEffect(() => {
    const last = previous.current;
    previous.current = { code: room?.code, id: latest?.id };
    setPreviewId(undefined);
    if (!latest || last?.code !== room?.code || last?.id === latest.id) return;
    setPreviewId(latest.id);
    const timer = setTimeout(() => setPreviewId(undefined), 6000);
    return () => clearTimeout(timer);
  }, [room?.code, latest?.id]);
  const preview = latest?.id === previewId ? latest : undefined;
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
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const captchaRef = useRef<TurnstileInstance>(null),
    captchaToken = useRef(captcha);
  captchaToken.current = captcha;
  const [showBotHands, setShowBotHands] = useState(false);
  const [draftPreview, setDraftPreview] = useState<Play | null>(null);
  const [chatSeen, setChatSeen] = useState<{ code: string; ids: string[] } | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const unread =
    room && chatSeen?.code === room.code ? unreadMessages(room.messages, chatSeen.ids) : [];
  useEffect(() => {
    const change = () => setPageVisible(document.visibilityState === 'visible');
    change();
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!room) {
      setChatSeen(null);
      return;
    }
    let ids = room.messages.map((m) => m.id);
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(`taktik-chat-${room.code}`) ?? 'null',
      );
      if (Array.isArray(stored))
        ids = stored.filter((id): id is string => typeof id === 'string').slice(-100);
    } catch {
      /* Storage may be disabled. */
    }
    setChatSeen({ code: room.code, ids });
  }, [room?.code]);
  const messageKey = room?.messages.map((m) => m.id).join(',') ?? '';
  useEffect(() => {
    if (!room || !pageVisible || historyOpen || (mobile ? !mobileChatOpen : room.game && !chatOpen))
      return;
    const ids = room.messages.map((m) => m.id);
    setChatSeen({ code: room.code, ids });
    try {
      localStorage.setItem(`taktik-chat-${room.code}`, JSON.stringify(ids));
    } catch {
      /* Storage may be disabled. */
    }
  }, [
    messageKey,
    room?.code,
    chatOpen,
    historyOpen,
    mobile,
    mobileChatOpen,
    pageVisible,
    Boolean(room?.game),
  ]);
  const alive = useRef(true);
  const generation = useRef(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const connection = useRef<string | null>(null);
  const syncing = useRef(false);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  function saveRecent(code: string) {
    setRecentRooms((previous) => {
      const next = rememberRoom(code, previous);
      try {
        localStorage.setItem('taktik-recent-rooms', JSON.stringify(next));
      } catch {
        /* Storage may be disabled. */
      }
      return next;
    });
  }
  function returnHome() {
    generation.current++;
    roomRef.current = null;
    setRoom(null);
    setLocal(null);
    setPlayable([]);
    setDestinations([]);
    setSelectedPiece(undefined);
    setHistoryOpen(false);
    setChatOpen(true);
    setMobileChatOpen(false);
    setTab('public');
    setConnectionError('');
    history.replaceState(null, '', location.pathname);
  }
  async function leaveCurrent() {
    if (!room) {
      returnHome();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api({
        type: 'leave',
        code: room.code,
        version: room.version,
        connection: connection.current!,
      });
      if (result.resumable) saveRecent(room.code);
      else
        setRecentRooms((previous) => {
          const next = previous.filter((c) => c !== room.code);
          try {
            localStorage.setItem('taktik-recent-rooms', JSON.stringify(next));
          } catch {}
          return next;
        });
      returnHome();
      setNotice(
        result.resumable
          ? 'Vous avez quitté la table. Votre place est conservée dans Mes parties récentes.'
          : 'Vous avez quitté le salon. Votre place est libre.',
      );
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) await synchronize(room.code);
      else {
        returnHome();
        setNotice(
          "Retour à l'accueil. Sans connexion, votre place reste conservée ; la présence expirera sous 45 secondes.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
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
    try {
      return await requestGame(command, session);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session)
        throw new Error(
          'Session interrompue. Gardez ce navigateur ouvert et reconnectez-vous. Votre place reste conservée.',
        );
      // Only reads can be replayed automatically. Never replay a move or a join.
      if (canRetryAfterRefresh(command)) return requestGame(command, refreshed.data.session);
      throw new ApiError(401, 'Session renouvelée. Synchronisez avant de refaire votre action.');
    }
  }, []);
  const loadRecentRoom = useCallback(
    (roomCode: string) => api({ type: 'sync', code: roomCode }),
    [api],
  );
  const synchronize = useCallback(
    async (roomCode: string, heartbeat = false) => {
      if (syncing.current) return;
      syncing.current = true;
      const epoch = generation.current;
      try {
        let next: RoomView;
        const current = roomRef.current;
        try {
          next =
            heartbeat && current?.code === roomCode && connection.current
              ? await api({
                  type: 'presence',
                  code: roomCode,
                  version: current.version,
                  connection: connection.current,
                  active: document.visibilityState === 'visible',
                })
              : await api({ type: 'sync', code: roomCode });
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 409) throw e;
          next = await api({ type: 'sync', code: roomCode });
        }
        if (alive.current && epoch === generation.current) {
          receive(next);
          setConnectionError('');
        }
      } catch (e) {
        if (alive.current && epoch === generation.current) {
          setConnectionError((e as Error).message);
          // Origin failures and transport errors must never erase the current table.
          if (hasLostRoomAccess(e)) {
            setError((e as Error).message);
            returnHome();
          }
        }
      } finally {
        syncing.current = false;
      }
    },
    [api, receive],
  );
  useEffect(() => {
    alive.current = true;
    connection.current ??= crypto.randomUUID();
    try {
      setRecentRooms(parseRecentRooms(localStorage.getItem('taktik-recent-rooms')));
      setName(localStorage.getItem('taktik-name') ?? '');
    } catch {
      /* Private browsing can disable storage. */
    }
    const invitation = new URLSearchParams(location.search).get('salon');
    const epoch = generation.current;
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
            const next = await api({ type: 'sync', code: invitation.toUpperCase() });
            if (alive.current && epoch === generation.current) {
              receive(next);
              saveRecent(next.code);
            }
          } catch (e) {
            if (alive.current && (!(e instanceof ApiError) || e.code !== 'NOT_MEMBER'))
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
  }, [receive, api]);
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void synchronize(roomCode, true);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void synchronize(roomCode, true);
    }, 15000);
    const focus = () => void synchronize(roomCode, true);
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    document.addEventListener('visibilitychange', focus);
    void synchronize(roomCode, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
      document.removeEventListener('visibilitychange', focus);
      void client.removeChannel(channel);
    };
  }, [room?.code, Boolean(local), synchronize]);
  useEffect(() => {
    if (local && pendingBot(local) >= 0) {
      const timer = setTimeout(
        () => setLocal((g) => (g ? stepBot(g, Math.random) : g)),
        BOT_DELAY_MS,
      );
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
    }, BOT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room?.version, room?.code, Boolean(local), api, receive, synchronize]);
  async function run(command: Exclude<Command, { type: 'list' | 'leave' }>): Promise<boolean> {
    setBusy(true);
    setError('');
    const epoch =
      command.type === 'create' || command.type === 'join'
        ? ++generation.current
        : generation.current;
    try {
      const next = await api(command, command.type === 'create' || command.type === 'join');
      if (epoch !== generation.current) return false;
      receive(next);
      setConnectionError('');
      saveRecent(next.code);
      try {
        localStorage.setItem('taktik-name', name.trim());
      } catch {}
      if (command.type === 'create' || command.type === 'join') {
        const address = new URL(location.href);
        address.searchParams.set('salon', next.code);
        history.replaceState(null, '', address);
        setHistoryOpen(false);
        setChatOpen(true);
        setMobileChatOpen(false);
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
    generation.current++;
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
    setHistoryOpen(false);
    setChatOpen(true);
    setMobileChatOpen(false);
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
  async function loadPublicRooms() {
    setBusy(true);
    setError('');
    try {
      setPublicRooms((await api({ type: 'list' }, true)).rooms);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function joinPublic(roomCode: string) {
    if (!name.trim()) {
      setError('Indiquez votre pseudo ci-dessus pour rejoindre cette partie.');
      nameInput.current?.focus();
      return;
    }
    void run({ type: 'join', code: roomCode, name });
  }
  async function resumeRoom(roomCode: string) {
    setBusy(true);
    setError('');
    const epoch = ++generation.current;
    try {
      const next = await api({ type: 'sync', code: roomCode });
      if (epoch !== generation.current) return;
      receive(next);
      saveRecent(next.code);
      setConnectionError('');
      history.replaceState(null, '', `${location.pathname}?salon=${next.code}`);
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
          {(local || room) && (
            <button disabled={busy} onClick={leaveCurrent}>
              Quitter la table
            </button>
          )}
        </nav>
      </header>
      {room && !local && connectionError && (
        <div className="connection-status" role="status">
          <span>Synchronisation interrompue. {connectionError}</span>
          <button disabled={busy} onClick={() => synchronize(room.code)}>
            Réessayer maintenant
          </button>
        </div>
      )}
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
      {mobile && room && !local && (
        <MobileChat
          key={room.code}
          messages={room.messages}
          unread={unread.length}
          open={mobileChatOpen}
          setOpen={setMobileChatOpen}
          onSend={(id, text) => run({ type: 'chat', code: room.code, id, text })}
        />
      )}
      {!mobile && unread.length > 0 && room?.game && !chatOpen && !historyOpen && (
        <button className="chat-notification" onClick={() => setChatOpen(true)} aria-live="polite">
          {unread.length} nouveau{unread.length > 1 ? 'x' : ''} message
          {unread.length > 1 ? 's' : ''} - {unread.at(-1)?.name} - Ouvrir le chat
        </button>
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
        <section className="lobby-layout home-layout">
          <div className="setup-panel">
            <h1>Jouer au TAC-TIK</h1>
            <div className="tabs home-tabs" aria-label="Choisir comment jouer">
              <button
                aria-pressed={tab === 'public'}
                className={tab === 'public' ? 'selected' : ''}
                onClick={() => setTab('public')}
              >
                Salons publics
              </button>
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
                Avec un code
              </button>
              <button
                aria-pressed={tab === 'solo'}
                className={tab === 'solo' ? 'selected' : ''}
                onClick={() => setTab('solo')}
              >
                Contre les bots
              </button>
              {recentRooms.length > 0 && (
                <button
                  aria-pressed={tab === 'recent'}
                  className={tab === 'recent' ? 'selected' : ''}
                  onClick={() => setTab('recent')}
                >
                  Mes parties ({recentRooms.length})
                </button>
              )}
            </div>
            {tab !== 'recent' && tab !== 'solo' && (
              <div className="home-identity">
                <label className="nickname-label" htmlFor="player-name">
                  Votre pseudo
                </label>
                <input
                  ref={nameInput}
                  id="player-name"
                  className="nickname-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="Votre nom dans la partie"
                  aria-describedby="nickname-help"
                />
                <p id="nickname-help" className="muted">
                  Pour rejoindre ou créer un salon.
                </p>
              </div>
            )}
            {tab !== 'recent' && tab !== 'solo' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tab === 'public') {
                    void loadPublicRooms();
                    return;
                  }
                  if (!name.trim()) {
                    setError('Indiquez votre pseudo pour continuer.');
                    nameInput.current?.focus();
                    return;
                  }
                  void run(
                    tab === 'create'
                      ? { type: 'create', name, capacity, jokers, public: publicRoom }
                      : { type: 'join', name, code },
                  );
                }}
              >
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
                ) : tab === 'join' ? (
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
                ) : (
                  <p>Rejoignez une table ouverte, sans code d'invitation.</p>
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
                  {busy
                    ? 'Chargement...'
                    : tab === 'public'
                      ? publicRooms
                        ? 'Actualiser les salons'
                        : 'Afficher les salons publics'
                      : tab === 'create'
                        ? 'Créer le salon'
                        : 'Rejoindre le salon'}
                </button>
                {!onlineConfigured && <p className="error-text">{configurationIssue}</p>}
              </form>
            )}
            {tab === 'public' && (
              <section className="public-rooms" aria-label="Salons publics">
                {publicRooms?.length === 0 && <p>Aucun salon disponible pour le moment.</p>}
                {publicRooms?.map((item) => (
                  <div className="public-room" key={item.code}>
                    <span>
                      <b>{item.name}</b> - {item.players}/{item.capacity} joueurs
                      <br />
                      {item.jokers ? 'Avec Joker' : 'Sans Joker'}
                    </span>
                    <button disabled={connectionDisabled} onClick={() => joinPublic(item.code)}>
                      Rejoindre
                    </button>
                  </div>
                ))}
                {publicRooms && !name.trim() && (
                  <p className="muted">Renseignez votre pseudo pour rejoindre.</p>
                )}
              </section>
            )}
            {tab === 'recent' && (
              <RecentRooms
                codes={recentRooms}
                signedIn={signedIn}
                busy={busy}
                load={loadRecentRoom}
                resume={resumeRoom}
              />
            )}
            {tab === 'solo' && (
              <div className="solo-entry">
                <h2>Jouer contre les bots</h2>
                <fieldset>
                  <legend>Nombre de joueurs, vous compris</legend>
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
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={showBotHands}
                    onChange={(e) => setShowBotHands(e.target.checked)}
                  />
                  Observer les cartes des bots (solo uniquement)
                </label>
                <button className="secondary wide" onClick={solo}>
                  Jouer contre {capacity - 1} bots
                </button>
                <span className="muted">Local, sans connexion. {capacity} joueurs.</span>
              </div>
            )}
          </div>
          <section className="setup-preview home-preview" aria-label="Aperçu du plateau">
            <h2>Plateau pour {capacity} joueurs</h2>
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
            <a
              className="admin-link"
              href="/admin"
              aria-label="Administration"
              title="Administration"
            >
              ⚙
            </a>
          </section>
        </section>
      )}
      {room && !view && (
        <section className="waiting-layout">
          <div className="setup-panel">
            <h1>Salon {room.code}</h1>
            <p className="muted">
              Présence actualisée toutes les 15 s. Absent après 45 s sans signal.
            </p>
            <p>
              {room.people.length} / {room.capacity} joueurs ·{' '}
              {room.jokers ? 'Avec Joker' : 'Sans Joker'}
            </p>
            <div className="seats">
              {Array.from({ length: room.capacity }, (_, i) => (
                <div className="seat" key={i}>
                  <span>
                    {room.capacity >= 4 ? `Équipe ${1 + (i % (room.capacity / 2))}` : i + 1}
                  </span>
                  <b>{room.people[i]?.name ?? 'Place libre'}</b>
                  {preview?.seat === i && <span className="speech-bubble">{preview.text}</span>}
                  <small>
                    {room.people[i]?.me ? 'Vous - ' : ''}
                    {room.people[i] ? PRESENCE_LABELS[room.people[i].presence] : ''}
                  </small>
                  {room.host &&
                    i > 0 &&
                    room.capacity >= 4 &&
                    room.people.length === room.capacity && (
                      <select
                        aria-label={`Changer l'équipe de ${room.people[i].name}`}
                        disabled={busy}
                        value=""
                        onChange={(e) =>
                          run({
                            type: 'swap-seats',
                            code: room.code,
                            version: room.version,
                            seat: i,
                            target: Number(e.target.value),
                          })
                        }
                      >
                        <option value="" disabled>
                          Changer d'équipe
                        </option>
                        {room.people.map(
                          (other, target) =>
                            target > 0 &&
                            target % (room.capacity / 2) !== i % (room.capacity / 2) && (
                              <option key={target} value={target}>
                                Équipe {1 + (target % (room.capacity / 2))} - échanger avec{' '}
                                {other.name}
                              </option>
                            ),
                        )}
                      </select>
                    )}
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
              {room.capacity >= 4
                ? "Les partenaires jouent face à face. Une fois le salon complet, l'hôte peut échanger les places pour composer les équipes."
                : ''}
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
          {!mobile && (
            <div className="setup-panel">
              <h2>Chat du salon</h2>
              <Chat
                messages={room.messages}
                onSend={(id, text) => run({ type: 'chat', code: room.code, id, text })}
              />
            </div>
          )}
        </section>
      )}
      {view && (
        <div className="game-layout">
          <section className="table-area">
            <PlayerList preview={preview} view={view} room={room} local={Boolean(local)} />
            <div className={`board-stage ${zoom ? 'zoomed' : ''}`}>
              <Board
                game={view}
                orient
                selected={selectedPiece}
                playable={busy ? [] : playable}
                destinations={destinations}
                historyChanges={
                  draftPreview &&
                  view.options.some(
                    (p) =>
                      p.cardIndex === draftPreview.cardIndex &&
                      p.as === draftPreview.as &&
                      JSON.stringify(p.moves) === JSON.stringify(draftPreview.moves),
                  )
                    ? simulateMoves(
                        view,
                        view.me,
                        draftPreview.moves,
                        (draftPreview.as ?? view.hand[draftPreview.cardIndex]) === 7,
                      ).changes
                    : []
                }
                onMove={(move) => !busy && interaction.current.move(move)}
                onPiece={(id) => !busy && interaction.current.piece(id)}
              />
            </div>
            <div className="board-tools">
              <span>
                ◆ Pieu · D : donneur · 1 : commence la donne · {view.deckCount} cartes en pioche
              </span>
              <button aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
                {zoom ? 'Ajuster le plateau' : 'Agrandir'}
              </button>
            </div>
          </section>
          <aside className="game-sidebar">
            {local && (
              <div className="training-options">
                <label>
                  <input
                    type="checkbox"
                    checked={showBotHands}
                    onChange={(e) => setShowBotHands(e.target.checked)}
                  />
                  Voir les cartes des bots
                </label>
              </div>
            )}
            <TurnControls
              view={view}
              busy={busy}
              selectedPiece={selectedPiece}
              onPiece={setSelectedPiece}
              onPlayable={setPlayable}
              onDestinations={setDestinations}
              onPreview={setDraftPreview}
              interaction={interaction}
              onExchange={submitExchange}
              onPlay={submitPlay}
              onDiscardHand={submitDiscard}
            />
            {local && showBotHands && <BotHands game={local} />}
            <section className="session-panel">
              <header className="table-panel-heading">
                {room && !local && !mobile ? (
                  <button
                    type="button"
                    className="chat-toggle"
                    aria-expanded={chatOpen}
                    onClick={() => setChatOpen(!chatOpen)}
                  >
                    Chat du salon{' '}
                    {unread.length > 0 && !chatOpen && <small>({unread.length} non lus)</small>}
                    <span aria-hidden="true">{chatOpen ? '▾' : '▸'}</span>
                  </button>
                ) : (
                  <strong>Journal de la table</strong>
                )}
                <button aria-haspopup="dialog" onClick={() => setHistoryOpen(true)}>
                  Historique
                </button>
              </header>
              {room && !local && !mobile ? (
                <div className="table-chat" hidden={!chatOpen}>
                  <Chat
                    visible={chatOpen}
                    messages={room.messages}
                    onSend={(id, text) => run({ type: 'chat', code: room.code, id, text })}
                  />
                </div>
              ) : (
                <p className="last-event">{view.log[0]}</p>
              )}
              {historyOpen && <HistoryPanel view={view} onClose={() => setHistoryOpen(false)} />}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
