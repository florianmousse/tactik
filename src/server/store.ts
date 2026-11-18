import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type { Room, RoomView } from '@/game/room';
import { createGame, exchange, play, RuleError, viewFor } from '@/game/engine';
import type { Command } from './schema';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    (process.env.RATE_LIMIT_SECRET?.length ?? 0) < 32 ||
    (process.env.NODE_ENV === 'production' &&
      (!process.env.APP_ORIGIN || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY))
  )
    throw new HttpError(
      503,
      'Le multijoueur n’est pas encore configuré. Le mode local reste disponible.',
    );
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function limit(key: string, maximum: number, seconds = 60) {
  const digest = createHmac('sha256', process.env.RATE_LIMIT_SECRET!).update(key).digest('hex');
  const { data, error } = await admin().rpc('consume_rate_limit', {
    p_key: digest,
    p_max: maximum,
    p_seconds: seconds,
  });
  if (error) throw new HttpError(503, 'Service temporairement indisponible.');
  if (!data) throw new HttpError(429, 'Trop de requêtes. Réessayez dans un instant.');
}
const random = () => randomInt(0, 2 ** 32) / 2 ** 32;
function projection(code: string, version: number, room: Room, user: string): RoomView {
  return {
    code,
    version,
    host: room.host === user,
    capacity: room.capacity,
    people: room.people.map((p) => ({ name: p.name, me: p.id === user })),
    game: room.game ? viewFor(room.game, user) : null,
  };
}
export async function dispatch(command: Command, user: string): Promise<RoomView> {
  const db = admin();
  if (command.type === 'create') {
    await limit(`create:${user}`, 5, 3600);
    const code = randomBytes(6).toString('hex').toUpperCase();
    const room: Room = {
      host: user,
      capacity: command.capacity,
      people: [{ id: user, name: command.name }],
      game: null,
    };
    const { error } = await db.rpc('create_game_room', {
      p_code: code,
      p_state: room,
      p_user: user,
    });
    if (error) throw new HttpError(503, 'Création impossible. Réessayez.');
    return projection(code, 0, room, user);
  }
  if (command.type === 'join') await limit(`join:${user}`, 15);
  const { data, error } = await db
    .from('game_rooms')
    .select('state,version')
    .eq('code', command.code)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new HttpError(503, 'Service temporairement indisponible.');
  if (!data) throw new HttpError(404, 'Salon introuvable ou expiré.');
  const room = data.state as Room,
    member = room.people.findIndex((p) => p.id === user);
  if (command.type === 'join') {
    if (member >= 0) return projection(command.code, data.version, room, user);
    if (room.game || room.people.length >= room.capacity)
      throw new HttpError(409, 'Ce salon est complet ou la partie a commencé.');
    room.people.push({ id: user, name: command.name });
  } else {
    if (member < 0) throw new HttpError(403, 'Vous ne faites pas partie de ce salon.');
    if (command.type === 'sync') return projection(command.code, data.version, room, user);
    if (command.version !== data.version)
      throw new HttpError(409, 'La partie a changé. Actualisez avant de jouer.');
    if (command.type === 'start') {
      if (room.host !== user || room.game || room.people.length !== room.capacity)
        throw new HttpError(409, 'Seul l’hôte peut commencer lorsque le salon est complet.');
      room.game = createGame(room.people, random);
    } else {
      if (!room.game) throw new HttpError(409, 'La partie n’a pas commencé.');
      try {
        room.game =
          command.type === 'exchange'
            ? exchange(room.game, member, command.cardIndex)
            : play(room.game, member, command.play, random);
      } catch (e) {
        if (e instanceof RuleError) throw new HttpError(400, e.message);
        throw e;
      }
    }
  }
  const { data: committed, error: saveError } = await db.rpc('commit_game_room', {
    p_code: command.code,
    p_version: data.version,
    p_state: room,
  });
  if (saveError) throw new HttpError(503, 'Sauvegarde impossible. Actualisez la partie.');
  if (!committed) throw new HttpError(409, 'Un autre joueur vient d’agir. Actualisez la partie.');
  return projection(command.code, data.version + 1, room, user);
}
