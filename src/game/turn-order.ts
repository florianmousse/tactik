import type { View } from './types';
export function turnOrder(view: View) {
  const first = (view.dealer + 1) % view.players.length;
  const nextDeal = (view.dealer + 2) % view.players.length;
  let next: number | null = null;
  if (view.phase === 'exchange') next = first;
  else if (view.phase === 'play') {
    for (let offset = 1; offset < view.players.length; offset++) {
      const seat = (view.turn + offset) % view.players.length;
      if (view.handCounts[seat] > 0) {
        next = seat;
        break;
      }
    }
    if (next === null && view.handCounts[view.turn] > 1) next = view.turn;
  }
  return { first, nextDeal, next };
}
