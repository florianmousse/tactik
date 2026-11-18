import type { Room } from '../game/room';

export function excludeGuest(room: Room, user: string, seat: number): Room {
  if (room.host !== user || room.game)
    throw new Error('Seul le créateur peut exclure avant le début.');
  const target = room.people[seat];
  if (!target || target.id === room.host || target.bot) throw new Error('Joueur invalide.');
  return {
    ...room,
    banned: [...(room.banned ?? []), target.id],
    people: room.people.filter((_, i) => i !== seat),
  };
}
