import 'server-only';
import { admin, HttpError, limit } from './store';
import { botCards, isAdmin, type AdminCommand, type AdminResult } from './admin-access';
import type { Room } from '@/game/room';
export async function dispatchAdmin(command: AdminCommand, user: string): Promise<AdminResult> {
  if (!isAdmin(user, process.env.ADMIN_USER_IDS))
    throw new HttpError(403, 'Ce compte ne dispose pas des droits administrateur.');
  await limit(`admin:${user}`, 30);
  const db = admin();
  if (command.type === 'delete') {
    const { data, error } = await db
      .from('game_rooms')
      .delete()
      .eq('code', command.code)
      .eq('version', command.version)
      .select('code');
    if (error) throw new HttpError(503, 'Suppression indisponible.');
    if (!data?.length)
      throw new HttpError(
        409,
        'Salon modifié ou déjà supprimé. Actualisez avant de confirmer à nouveau.',
      );
    return { deleted: true };
  }
  if (command.type === 'inspect') {
    const { data, error } = await db
      .from('game_rooms')
      .select('state')
      .eq('code', command.code)
      .maybeSingle();
    if (error) throw new HttpError(503, 'Lecture indisponible.');
    if (!data) throw new HttpError(404, 'Salon introuvable.');
    return { bots: botCards(data.state as Room) };
  }
  const { data, error } = await db
    .from('game_rooms')
    .select('code,version,state,expires_at')
    .order('code')
    .range(command.offset, command.offset + 30);
  if (error) throw new HttpError(503, 'Liste indisponible.');
  return {
    more: data.length > 30,
    rooms: data.slice(0, 30).map((row) => {
      const room = row.state as Room;
      return {
        code: row.code,
        version: row.version,
        expiresAt: row.expires_at,
        phase: room.game?.phase ?? 'waiting',
        players: room.people.map((p) => p.name),
        capacity: room.capacity,
      };
    }),
  };
}
