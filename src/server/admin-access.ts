import { z } from 'zod';
import type { Room } from '@/game/room';
import type { Card } from '@/game/types';
const code = z.string().regex(/^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/);
export const adminCommandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('list'), offset: z.number().int().min(0).max(100000).default(0) })
    .strict(),
  z.object({ type: z.literal('inspect'), code }).strict(),
  z.object({ type: z.literal('delete'), code, version: z.number().int().nonnegative() }).strict(),
]);
export type AdminCommand = z.infer<typeof adminCommandSchema>;
export type AdminRoom = {
  code: string;
  version: number;
  expiresAt: string;
  phase: string;
  players: string[];
  capacity: number;
};
export type AdminResult = {
  rooms?: AdminRoom[];
  more?: boolean;
  bots?: { name: string; cards: Card[] }[];
  deleted?: boolean;
};
export function isAdmin(user: string, allowlist: string | undefined): boolean {
  return (
    z.uuid().safeParse(user).success &&
    (allowlist ?? '')
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => z.uuid().safeParse(id).success)
      .includes(user.toLowerCase())
  );
}
// Explicit privileged projection: never return human hands, deck or exchange choices.
export function botCards(room: Room): NonNullable<AdminResult['bots']> {
  return (
    room.game?.players.flatMap((player, index) =>
      player.bot ? [{ name: player.name, cards: [...room.game!.hands[index]] }] : [],
    ) ?? []
  );
}
