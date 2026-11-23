import type { Game, Player, TurnRecord } from './types';

export type PlayerStats = {
  distance: number;
  captures: number;
  losses: number;
  starts: number;
  plays: number;
};
export type GameStats = { partial: boolean; players: PlayerStats[] };

export function emptyStats(players: Player[], partial = false): GameStats {
  return {
    partial,
    players: players.map(() => ({ distance: 0, captures: 0, losses: 0, starts: 0, plays: 0 })),
  };
}

// Update counters owned by the cloned game, once per committed turn.
export function countTurn(
  stats: GameStats,
  players: Player[],
  turn: Pick<TurnRecord, 'actor' | 'card' | 'as' | 'kind' | 'changes'>,
) {
  if (turn.kind !== 'play') return;
  const actor = stats.players[turn.actor];
  actor.plays++;
  const value = turn.as ?? turn.card;
  if (turn.changes.some((change) => change.from === -1)) actor.starts++;
  else if (typeof value === 'number') actor.distance += Math.abs(value);
  for (const change of turn.changes) {
    if (!change.captured) continue;
    actor.captures++;
    const owner = players.findIndex((player) => player.colors.includes(change.color));
    stats.players[owner].losses++;
  }
}

export function statsFor(game: Pick<Game, 'stats' | 'players' | 'history'>): GameStats {
  if (game.stats) return game.stats;
  const stats = emptyStats(game.players, true);
  for (const turn of game.history ?? []) countTurn(stats, game.players, turn);
  return stats;
}
