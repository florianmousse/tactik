import {
  CARDS,
  type Card,
  type Game,
  type Move,
  type Piece,
  type Play,
  type Player,
  type View,
} from './types';

export class RuleError extends Error {}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const colorCount = (g: Pick<Game, 'players'>) =>
  g.players.length === 2 || g.players.length === 4 ? 4 : 6;
export const trackLength = (g: Pick<Game, 'players'>) => colorCount(g) * 16;
// Clockwise seating: opposing partners. Color IDs are stable for the visual palette.
export const colorOrder = (g: Pick<Game, 'players'>) =>
  colorCount(g) === 4 ? [0, 2, 1, 3] : [0, 4, 2, 1, 5, 3];
export const startPosition = (g: Pick<Game, 'players'>, color: number) =>
  colorOrder(g).indexOf(color) * 16;
export function createGame(people: { id: string; name: string }[], random: () => number): Game {
  requireRule([2, 3, 4, 6].includes(people.length), 'Choisir 2, 3, 4 ou 6 joueurs.');
  requireRule(new Set(people.map((p) => p.id)).size === people.length, 'Joueurs dupliqués.');
  const order = people.length === 2 || people.length === 4 ? [0, 2, 1, 3] : [0, 4, 2, 1, 5, 3];
  const players: Player[] = people.map((p, i) => ({
    ...p,
    colors:
      people.length <= 3
        ? [
            [0, 1],
            [2, 3],
            [4, 5],
          ][i]
        : [order[i]],
    team: people.length <= 3 ? i : i % (people.length / 2),
  }));
  const g: Game = {
    players,
    pieces: order.flatMap((c) =>
      Array.from({ length: 4 }, (_, n) => ({
        id: `${c}-${n}`,
        color: c,
        position: -1,
        stake: false,
      })),
    ),
    hands: people.map(() => []),
    deck: shuffle(
      CARDS.flatMap((c) => [c, c, c, c]),
      random,
    ),
    discard: [],
    phase: 'exchange',
    exchanges: people.map(() => null),
    turn: 1,
    dealer: 0,
    winner: null,
    log: ['La partie commence. Échangez une carte.'],
    round: 0,
  };
  deal(g, random);
  return g;
}
function deal(g: Game, random: () => number) {
  const count = g.players.length === 2 ? 6 : 4;
  for (let c = 0; c < count; c++)
    for (let offset = 1; offset <= g.players.length; offset++) {
      if (!g.deck.length) {
        g.deck = shuffle(g.discard, random);
        g.discard = [];
      }
      const card = g.deck.pop();
      requireRule(card !== undefined, 'Pioche vide.');
      g.hands[(g.dealer + offset) % g.players.length].push(card);
    }
  g.exchanges = g.players.map(() => null);
  g.phase = 'exchange';
  g.round++;
  g.turn = (g.dealer + 1) % g.players.length;
}
export function exchange(given: Game, actor: number, index: number): Game {
  const g = structuredClone(given);
  requireRule(
    g.phase === 'exchange' && g.players[actor] && g.exchanges[actor] === null,
    'Échange indisponible.',
  );
  requireRule(
    Number.isInteger(index) && index >= 0 && index < g.hands[actor].length,
    'Carte inconnue.',
  );
  g.exchanges[actor] = index;
  if (g.exchanges.every((i) => i !== null)) {
    const cards = g.hands.map((h, i) => h.splice(g.exchanges[i]!, 1)[0]);
    cards.forEach((card, i) => {
      const recipient =
        g.players.length <= 3
          ? (i + 1) % g.players.length
          : (i + g.players.length / 2) % g.players.length;
      g.hands[recipient].push(card);
    });
    g.phase = 'play';
    g.log.unshift('Les cartes ont été échangées.');
  }
  return g;
}
export function activeColors(g: Game, actor: number): number[] {
  const player = g.players[actor];
  if (!player) return [];
  const done = (colors: number[]) =>
    g.pieces.filter((p) => colors.includes(p.color)).every((p) => p.position >= trackLength(g));
  if (g.players.length > 3 && done(player.colors))
    return g.players.find((p) => p.id !== player.id && p.team === player.team)!.colors;
  return player.colors;
}
function execute(g: Game, actor: number, move: Move, eatPath: boolean): void {
  const length = trackLength(g),
    colors = activeColors(g, actor);
  const p = g.pieces.find((p) => p.id === move.piece);
  requireRule(p && colors.includes(p.color), 'Ce pion ne vous appartient pas.');
  const occupant = (position: number) =>
    g.pieces.find(
      (q) => q.id !== p.id && q.position === position && (position < length || q.color === p.color),
    );
  const capture = (q: Piece) => {
    requireRule(!q.stake, 'Un pieu bloque le passage.');
    q.position = -1;
    q.stake = false;
  };
  if (move.kind === 'start') {
    requireRule(p.position === -1, 'Ce pion est déjà sorti.');
    const target = startPosition(g, p.color),
      q = occupant(target);
    if (q) capture(q);
    p.position = target;
    p.stake = true;
    return;
  }
  if (move.kind === 'swap') {
    const q = g.pieces.find((q) => q.id === move.target);
    requireRule(
      q &&
        q.id !== p.id &&
        p.position >= 0 &&
        p.position < length &&
        q.position >= 0 &&
        q.position < length,
      'Permutation impossible.',
    );
    requireRule(!q.stake || colors.includes(q.color), 'Un pieu adverse ne peut pas être permuté.');
    [p.position, q.position] = [q.position, p.position];
    p.stake = false;
    q.stake = false;
    return;
  }
  requireRule(p.position >= 0, 'Ce pion est dans la réserve.');
  requireRule(
    Number.isInteger(move.steps) && move.steps !== 0 && Math.abs(move.steps) <= 12,
    'Déplacement invalide.',
  );
  requireRule(!(p.position >= length && move.steps < 0), 'Impossible de reculer dans la maison.');
  const wasStake = p.stake;
  let entered = p.position >= length;
  for (let i = 0; i < Math.abs(move.steps); i++) {
    let next: number;
    if (p.position >= length) {
      next = p.position + 1;
      requireRule(next < length + 4, 'La valeur exacte est nécessaire.');
    } else if (move.steps > 0 && move.home && p.position === startPosition(g, p.color)) {
      requireRule(!wasStake, 'Un pieu ne peut pas entrer directement dans sa maison.');
      next = length;
      entered = true;
    } else next = (p.position + Math.sign(move.steps) + length) % length;
    const q = occupant(next);
    if (q) {
      requireRule(!q.stake && next < length, 'Passage bloqué.');
      if (eatPath || i === Math.abs(move.steps) - 1) capture(q);
    }
    p.position = next;
  }
  requireRule(!move.home || entered, 'La maison est hors de portée.');
  p.stake = false;
}
function candidates(
  g: Game,
  actor: number,
  card: Card,
  used: string[] = [],
  remaining = 7,
  color?: number,
): Move[] {
  const length = trackLength(g),
    colors = activeColors(g, actor),
    result: Move[] = [];
  for (const p of g.pieces.filter(
    (p) =>
      colors.includes(p.color) &&
      !used.includes(p.id) &&
      (color === undefined || p.color === color),
  )) {
    if (card === 1 || card === 10) result.push({ kind: 'start', piece: p.id });
    if (card === 'swap')
      for (const q of g.pieces) result.push({ kind: 'swap', piece: p.id, target: q.id });
    else
      for (const steps of card === 7
        ? Array.from({ length: remaining }, (_, i) => i + 1)
        : [card]) {
        result.push({ kind: 'move', piece: p.id, steps });
        if (steps > 0 && p.position < length)
          result.push({ kind: 'move', piece: p.id, steps, home: true });
      }
  }
  return result.filter((m) => {
    try {
      execute(structuredClone(g), actor, m, card === 7);
      return true;
    } catch {
      return false;
    }
  });
}
// All legal full-card actions, including ordered partitions of the seven.
export function legalPlays(g: Game, actor: number, onlyFirst = false): Play[] {
  if (g.phase !== 'play' || g.turn !== actor) return [];
  const output: Play[] = [];
  for (let index = 0; index < g.hands[actor].length; index++) {
    const card = g.hands[actor][index];
    if (card !== 7) {
      for (const move of candidates(g, actor, card)) {
        output.push({ cardIndex: index, moves: [move] });
        if (onlyFirst) return output;
      }
    } else {
      const visit = (state: Game, moves: Move[], remaining: number, color?: number): boolean => {
        if (!remaining) {
          output.push({ cardIndex: index, moves });
          return onlyFirst;
        }
        for (const m of candidates(
          state,
          actor,
          7,
          moves.map((m) => m.piece),
          remaining,
          color,
        )) {
          if (m.kind !== 'move') continue;
          const next = structuredClone(state);
          execute(next, actor, m, true);
          if (
            visit(
              next,
              [...moves, m],
              remaining - m.steps,
              color ?? state.pieces.find((p) => p.id === m.piece)!.color,
            )
          )
            return true;
        }
        return false;
      };
      if (visit(g, [], 7)) return output;
    }
  }
  return output;
}
export function play(given: Game, actor: number, action: Play, random: () => number): Game {
  requireRule(given.phase === 'play' && given.turn === actor, 'Ce n’est pas votre tour.');
  const g = structuredClone(given),
    card = g.hands[actor][action.cardIndex];
  requireRule(
    card !== undefined && Number.isInteger(action.cardIndex) && action.cardIndex >= 0,
    'Carte inconnue.',
  );
  if (!action.moves.length)
    requireRule(
      legalPlays(g, actor, true).length === 0,
      'Vous devez jouer si un coup est possible.',
    );
  else {
    requireRule(action.moves.length <= 4, 'Trop de déplacements.');
    if (card === 7) {
      requireRule(
        action.moves.every((m) => m.kind === 'move' && m.steps > 0) &&
          action.moves.reduce((n, m) => n + (m.kind === 'move' ? m.steps : 0), 0) === 7,
        'Le 7 doit être joué entièrement.',
      );
      requireRule(
        new Set(action.moves.map((m) => m.piece)).size === action.moves.length,
        'Un seul déplacement par pion.',
      );
      requireRule(
        new Set(action.moves.map((m) => g.pieces.find((p) => p.id === m.piece)?.color)).size === 1,
        'Une seule couleur pour le 7.',
      );
    } else {
      requireRule(action.moves.length === 1, 'Un seul déplacement avec cette carte.');
      const m = action.moves[0];
      requireRule(
        m.kind === 'start'
          ? card === 1 || card === 10
          : m.kind === 'swap'
            ? card === 'swap'
            : card !== 'swap' && m.steps === card,
        'Cette action ne correspond pas à la carte.',
      );
    }
    // Freeze control for the complete card: helping a partner starts next turn.
    const allowed = activeColors(given, actor);
    for (const m of action.moves) {
      requireRule(
        allowed.includes(g.pieces.find((p) => p.id === m.piece)?.color ?? -1),
        'Couleur interdite.',
      );
      execute(g, actor, m, card === 7);
    }
  }
  g.hands[actor].splice(action.cardIndex, 1);
  g.discard.push(card);
  g.log.unshift(
    `${g.players[actor].name} ${action.moves.length ? 'joue' : 'défausse'} ${card === 'swap' ? 'Permutation' : card}.`,
  );
  g.log = g.log.slice(0, 30);
  const team = g.players[actor].team,
    teamColors = g.players.filter((p) => p.team === team).flatMap((p) => p.colors);
  if (
    g.pieces.filter((p) => teamColors.includes(p.color)).every((p) => p.position >= trackLength(g))
  ) {
    g.phase = 'finished';
    g.winner = team;
    g.log.unshift('La partie est terminée !');
  } else if (g.hands.every((h) => !h.length)) {
    g.dealer = (g.dealer + 1) % g.players.length;
    deal(g, random);
  } else {
    do {
      g.turn = (g.turn + 1) % g.players.length;
    } while (!g.hands[g.turn].length);
  }
  return g;
}
export function viewFor(g: Game, id: string): View {
  const me = g.players.findIndex((p) => p.id === id);
  requireRule(me >= 0, 'Accès refusé.');
  const { hands, deck, exchanges, ...publicState } = structuredClone(g);
  return {
    ...publicState,
    hand: hands[me],
    handCounts: hands.map((h) => h.length),
    exchanged: exchanges.map((i) => i !== null),
    deckCount: deck.length,
    me,
    options: legalPlays(g, me),
  };
}
