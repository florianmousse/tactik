import type { Room } from '../game/room';

export function leaveTable(room: Room, user: string): Room {
  if (!room.people.some((p) => p.id === user && !p.bot)) throw new Error('Membre requis.');
  if (room.game) return room;
  const people = room.people.filter((p) => p.id !== user);
  const successor = people.find((p) => !p.bot);
  const ordered =
    successor && room.host === user
      ? [successor, ...people.filter((p) => p.id !== successor.id)]
      : people;
  return {
    ...room,
    people: successor ? ordered : [],
    host: room.host === user ? (successor?.id ?? room.host) : room.host,
    closed: !successor,
    public: successor ? room.public : false,
  };
}

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
