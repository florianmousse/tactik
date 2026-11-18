import {
  activeColors,
  canDiscardHand,
  discardHand,
  exchange,
  play,
  simulateMoves,
  startPosition,
  trackLength,
  viewFor,
} from './engine';
import type { Game, Play, View } from './types';

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
    return { action, friendlyCaptures, score: score + random() * 0.1 };
  });
  // Prefer every safe legal alternative. Self-capture remains legal if forced by the rules.
  scored.sort((a, b) => a.friendlyCaptures - b.friendlyCaptures || b.score - a.score);
  return scored[0]?.action ?? { cardIndex: 0, moves: [] };
}
export function chooseBotExchange(view: View): number {
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
