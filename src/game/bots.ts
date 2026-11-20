import {
  activeColors,
  canDiscardHand,
  discardHand,
  exchange,
  play,
  playsForHand,
  simulateMoves,
  startPosition,
  trackLength,
  viewFor,
} from './engine';
import { CARDS, type Card, type Game, type Play, type View } from './types';
import { cardChance } from './card-knowledge';

export function pendingBot(
  g: Pick<Game, 'phase' | 'players' | 'turn'> &
    ({ exchanges: Game['exchanges'] } | { exchanged: boolean[] }),
): number {
  if (g.phase === 'finished') return -1;
  if (g.phase === 'exchange')
    return g.players.findIndex(
      (p, i) => p.bot && ('exchanges' in g ? g.exchanges[i] === null : !g.exchanged[i]),
    );
  return g.players[g.turn].bot ? g.turn : -1;
}
// A bot sees the same projection as a human, never another hand or the deck order.
export function chooseBotPlay(view: View, random: () => number): Play {
  const length = trackLength(view);
  const team = view.players[view.me].team;
  const allies = view.players.filter((p) => p.team === team).flatMap((p) => p.colors);
  const progress = (color: number, position: number) =>
    position < 0
      ? -25
      : position >= length
        ? length + 60 + (position - length) * 12
        : (position - startPosition(view, color) + length) % length;
  const finishCache = new Map<string, Card[]>();
  const scored = view.options.map((action) => {
    const card = action.as ?? view.hand[action.cardIndex];
    const result = simulateMoves(view, view.me, action.moves, card === 7);
    const friendlyCaptures = result.changes.filter(
      (c) => c.captured && allies.includes(c.color),
    ).length;
    let score = result.changes.filter((c) => c.captured && !allies.includes(c.color)).length * 45;
    for (const p of result.pieces) {
      const before = view.pieces.find((q) => q.id === p.id)!;
      if (allies.includes(p.color)) {
        score += progress(p.color, p.position) - progress(p.color, before.position);
        if (before.position < 0 && p.position >= 0) score += 20;
        if (before.stake && !p.stake) score += 6;
      } else if (before.position >= 0 && p.position >= 0) {
        score -= (progress(p.color, p.position) - progress(p.color, before.position)) * 0.5;
      }
    }
    if (view.hand[action.cardIndex] === 'joker') score -= 8;
    // In a shared endgame, do not strand the last pawn on an impossible remainder.
    const unfinished = result.pieces.filter((p) => allies.includes(p.color) && p.position < length);
    if (unfinished.length === 0) score += 2000;
    else if (unfinished.length === 1 && unfinished[0].position >= 0 && !friendlyCaptures) {
      const board = { players: view.players, pieces: result.pieces };
      const key = result.pieces.map((p) => `${p.position}:${Number(p.stake)}`).join(',');
      let continuation = 0;
      for (let actor = 0; actor < view.players.length; actor++) {
        if (
          view.players[actor].team !== team ||
          !activeColors(board, actor).includes(unfinished[0].color)
        )
          continue;
        const remaining =
          actor === view.me ? view.hand.filter((_, index) => index !== action.cardIndex) : [];
        if (actor === view.me && !remaining.length) continue;
        if (actor !== view.me && !view.handCounts[actor]) continue;
        const cacheKey = `${actor}:${key}`;
        let useful = finishCache.get(cacheKey);
        if (!useful) {
          useful = finishingCards(board, actor, allies, Boolean(view.jokers));
          finishCache.set(cacheKey, useful);
        }
        const chance =
          actor === view.me
            ? Number(remaining.some((card) => useful.includes(card)))
            : cardChance(view, actor, useful);
        continuation = Math.max(continuation, chance * (actor === view.me ? 0.8 : 0.9));
      }
      score += continuation * 600;
    }
    return { action, friendlyCaptures, score: score + random() * 0.1 };
  });
  // Prefer every safe legal alternative. Self-capture remains legal if forced by the rules.
  scored.sort((a, b) => a.friendlyCaptures - b.friendlyCaptures || b.score - a.score);
  return scored[0]?.action ?? { cardIndex: 0, moves: [] };
}
function basicExchange(view: View): number {
  const starter = (c: View['hand'][number]) => c === 1 || c === 10 || c === 'joker';
  const starters = view.hand.map((card, index) => ({ card, index })).filter((c) => starter(c.card));
  const partner = view.players.find(
    (p) => p.id !== view.players[view.me].id && p.team === view.players[view.me].team,
  );
  const own = view.pieces.filter((p) => activeColors(view, view.me).includes(p.color));
  const partnerNeedsStart =
    partner &&
    view.pieces.filter((p) => partner.colors.includes(p.color)).every((p) => p.position < 0);
  if (
    partnerNeedsStart &&
    (starters.length > 1 || own.filter((p) => p.position >= 0).length >= 2)
  ) {
    return (
      starters.find((c) => c.card === 1)?.index ??
      starters.find((c) => c.card === 10)?.index ??
      starters[0]?.index ??
      0
    );
  }
  const ordinary = view.hand.findIndex((c) => !starter(c));
  return ordinary < 0 ? (starters.find((c) => c.card !== 'joker')?.index ?? 0) : ordinary;
}
function finishingCards(
  board: Pick<Game, 'players' | 'pieces'>,
  actor: number,
  colors: number[],
  jokers: boolean,
): Card[] {
  const length = trackLength(board);
  return [...CARDS, ...(jokers ? ['joker' as const] : [])].filter((printed) =>
    playsForHand(board, actor, [printed]).some((action) =>
      simulateMoves(board, actor, action.moves, (action.as ?? printed) === 7)
        .pieces.filter((p) => colors.includes(p.color))
        .every((p) => p.position >= length),
    ),
  );
}
// Evaluate a proposed gift with exactly that card, never the recipient's actual hand.
function giftValue(view: View, actor: number, card: Card): number {
  const colors = activeColors(view, actor),
    length = trackLength(view);
  const allies = view.players
    .filter((p) => p.team === view.players[actor].team)
    .flatMap((p) => p.colors);
  let best = 0;
  for (const action of playsForHand(view, actor, [card])) {
    const result = simulateMoves(view, actor, action.moves, (action.as ?? card) === 7);
    if (result.changes.some((c) => c.captured && allies.includes(c.color))) continue;
    let value = 0;
    for (const p of result.pieces.filter((p) => colors.includes(p.color))) {
      const before = view.pieces.find((q) => q.id === p.id)!;
      if (p.position >= length && before.position < length) value += 140;
      if (p.position >= length) value += (p.position - Math.max(length, before.position)) * 18;
      if (p.position >= 0 && before.position < 0) value += 45;
    }
    if (result.pieces.filter((p) => colors.includes(p.color)).every((p) => p.position >= length))
      value += 450;
    const unfinished = result.pieces.filter((p) => colors.includes(p.color) && p.position < length);
    if (unfinished.length === 1 && unfinished[0].position >= 0) {
      const board = { players: view.players, pieces: result.pieces };
      const useful = finishingCards(board, actor, colors, Boolean(view.jokers));
      const retained = view.hand.filter((_, index) => index !== view.hand.indexOf(card));
      const afterGift: View = {
        ...view,
        hand: actor === view.me ? retained : view.hand,
        handCounts: view.handCounts.map((count, seat) =>
          seat === actor ? Math.max(0, count - 1) : count,
        ),
      };
      let chance = cardChance(afterGift, actor, useful);
      // When both partners control the last color, our retained cards are known support.
      if (
        actor !== view.me &&
        view.players[actor].team === view.players[view.me].team &&
        activeColors(board, view.me).includes(unfinished[0].color)
      ) {
        const support = finishingCards(board, view.me, colors, Boolean(view.jokers));
        if (retained.some((c) => support.includes(c))) chance = 1;
      }
      value += 120 * chance;
    }
    best = Math.max(best, value);
  }
  return best;
}
export function chooseBotExchange(view: View): number {
  const recipient =
    view.players.length <= 3
      ? (view.me + 1) % view.players.length
      : (view.me + view.players.length / 2) % view.players.length;
  const allied = view.players[recipient].team === view.players[view.me].team;
  const fallback = basicExchange(view);
  const ownValues = view.hand.map((card) => giftValue(view, view.me, card));
  const own = view.pieces.filter((p) => activeColors(view, view.me).includes(p.color));
  const starter = (card: Card) => card === 1 || card === 10 || card === 'joker';
  let best = -Infinity,
    choice = fallback;
  view.hand.forEach((card, index) => {
    const replacement = Math.max(0, ...ownValues.filter((_, i) => i !== index));
    const losesOnlyStart =
      own.every((p) => p.position < 0) &&
      starter(card) &&
      !view.hand.some((c, i) => i !== index && starter(c));
    const score =
      (allied ? 1 : -1) * giftValue(view, recipient, card) -
      Math.max(0, ownValues[index] - replacement) * 0.35 -
      (losesOnlyStart ? 200 : 0) -
      (card === 'joker' ? 10 : 0) +
      (index === fallback ? 2 : 0);
    if (score > best) {
      best = score;
      choice = index;
    }
  });
  return choice;
}
export function stepBot(g: Game, random: () => number): Game {
  const actor = pendingBot(g);
  if (actor < 0) return g;
  const view = viewFor(g, g.players[actor].id);
  if (g.phase === 'exchange') {
    return exchange(g, actor, chooseBotExchange(view));
  }
  if (canDiscardHand(g, actor)) return discardHand(g, actor, random);
  return play(g, actor, chooseBotPlay(view, random), random);
}
