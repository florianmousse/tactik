import { canDiscardHand, discardHand, exchange, play, trackLength, viewFor } from './engine';
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
  const scored = view.options.map((action) => ({
    action,
    score:
      action.moves.reduce((score, m) => {
        const p = view.pieces.find((p) => p.id === m.piece)!;
        if (m.kind === 'start') return score + 25;
        if (m.kind === 'move')
          return (
            score +
            (m.home || p.position >= trackLength(view) ? 60 : 0) +
            Math.max(0, m.steps) +
            (p.stake ? 8 : 0)
          );
        return score + 1;
      }, 0) +
      random() * 3,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.action ?? { cardIndex: 0, moves: [] };
}
export function stepBot(g: Game, random: () => number): Game {
  const actor = pendingBot(g);
  if (actor < 0) return g;
  const view = viewFor(g, g.players[actor].id);
  if (g.phase === 'exchange') {
    const ordinary = view.hand.findIndex((c) => c !== 1 && c !== 10 && c !== 'joker');
    return exchange(g, actor, ordinary < 0 ? 0 : ordinary);
  }
  if (canDiscardHand(g, actor)) return discardHand(g, actor, random);
  return play(g, actor, chooseBotPlay(view, random), random);
}
