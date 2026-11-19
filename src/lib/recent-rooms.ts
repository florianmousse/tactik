export const validRoomCode = (code: string) => /^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/.test(code);
export function parseRecentRooms(value: string | null): string[] {
  try {
    const data: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(data)
      ? [
          ...new Set(data.filter((v): v is string => typeof v === 'string' && validRoomCode(v))),
        ].slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export function rememberRoom(code: string, previous: string[]): string[] {
  return [code, ...previous.filter((c) => c !== code)].filter(validRoomCode).slice(0, 8);
}
import type { RoomView } from '@/game/room';
import { COLOR_NAMES } from '@/game/labels';

export function summarizeRoom(room: RoomView) {
  const game = room.game;
  const me = game?.players[game.me];
  const winners =
    game?.phase === 'finished'
      ? game.players.filter((player) => player.team === game.winner).map((player) => player.name)
      : [];
  return {
    players: room.people.map((person) => `${person.name}${person.bot ? ' (bot)' : ''}`),
    count: room.people.length,
    capacity: room.capacity,
    jokers: room.jokers,
    round: game?.round ?? null,
    finished: game?.phase === 'finished',
    status:
      game?.phase === 'finished'
        ? `Terminée - Victoire de ${winners.join(' et ') || "l'équipe gagnante"}`
        : game
          ? game.phase === 'exchange'
            ? 'En cours - Échange de cartes'
            : 'En cours'
          : 'En attente de joueurs',
    me: me
      ? `${me.name} (${me.colors.map((color) => COLOR_NAMES[color]).join(', ')})`
      : (room.people.find((person) => person.me)?.name ?? ''),
    partner:
      me && game
        ? game.players
            .filter((player) => player.team === me.team && player.id !== me.id)
            .map((player) => player.name)
            .join(' et ')
        : '',
  };
}
export type RecentRoomSummary = ReturnType<typeof summarizeRoom>;
