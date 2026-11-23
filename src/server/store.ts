import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { Room, RoomView, RoomList, LeaveResult } from '@/game/room';
import { createGame, discardHand, exchange, play, RuleError, viewFor } from '@/game/engine';
import { pendingBot, stepBot } from '@/game/bots';
import type { Command } from './schema';
import { excludeGuest, leaveTable } from './room-access';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !key && 'SUPABASE_SERVICE_ROLE_KEY',
    (process.env.RATE_LIMIT_SECRET?.length ?? 0) < 32 &&
      'RATE_LIMIT_SECRET (32 caractères minimum)',
    process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN && 'APP_ORIGIN',
    process.env.NODE_ENV === 'production' &&
      !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  ].filter(Boolean);
  if (missing.length)
    throw new HttpError(
      503,
      `Configuration serveur incomplète : ${missing.join(', ')}. Redéployer après correction.`,
    );
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function limit(key: string, maximum: number, seconds = 60) {
  const digest = createHmac('sha256', process.env.RATE_LIMIT_SECRET!).update(key).digest('hex');
  const { data, error } = await admin().rpc('consume_rate_limit', {
    p_key: digest,
    p_max: maximum,
    p_seconds: seconds,
  });
  if (error)
    throw new HttpError(
      503,
      'Quotas indisponibles. Vérifier la migration SQL et la clé serveur Supabase.',
    );
  if (!data) throw new HttpError(429, 'Trop de requêtes. Réessayez dans un instant.');
}
const random = () => randomInt(0, 2 ** 32) / 2 ** 32;
async function projection(
  code: string,
  version: number,
  room: Room,
  user: string,
): Promise<RoomView> {
  const { data, error } = await admin()
    .from('room_messages')
    .select('id,user_id,name,text,created_at')
    .eq('room_code', code)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50);
  if (error)
    throw new HttpError(
      503,
      'Chat indisponible. Vérifier la migration 202611180002 dans Supabase.',
    );
  const presence = await admin()
    .from('room_presence')
    .select('user_id,active,seen_at')
    .eq('room_code', code)
    .gt('seen_at', new Date(Date.now() - 45000).toISOString());
  if (presence.error)
    throw new HttpError(503, 'Présence indisponible. Vérifier la migration 202611180004.');
  return {
    code,
    version,
    host: room.host === user,
    capacity: room.capacity,
    people: room.people.map((p) => ({
      name: p.name,
      me: p.id === user,
      bot: Boolean(p.bot),
      presence: p.bot
        ? 'bot'
        : presence.data.some((r) => r.user_id === p.id && r.active)
          ? 'online'
          : presence.data.some((r) => r.user_id === p.id)
            ? 'away'
            : 'offline',
    })),
    game: room.game ? viewFor(room.game, user) : null,
    jokers: room.jokers ?? false,
    messages: (data ?? []).reverse().map((m) => ({
      id: m.id,
      name: m.name,
      text: m.text,
      at: m.created_at,
      me: m.user_id === user,
    })),
  };
}
export async function dispatch(
  command: Command,
  user: string,
): Promise<RoomView | RoomList | LeaveResult> {
  const db = admin();
  if (command.type === 'list') {
    const { data, error } = await db.rpc('list_public_rooms');
    if (error)
      throw new HttpError(503, 'Liste indisponible. Vérifier la migration des salons publics.');
    return { rooms: data ?? [] };
  }
  if (command.type === 'create') {
    await limit(`create:${user}`, 5, 3600);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const room: Room = {
      host: user,
      public: command.public ?? false,
      capacity: command.capacity,
      people: [{ id: user, name: command.name }],
      game: null,
      jokers: command.jokers ?? true,
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
  if (!data) throw new HttpError(404, 'Salon introuvable ou expiré.', 'ROOM_GONE');
  const room = data.state as Room,
    member = room.people.findIndex((p) => p.id === user);
  if (command.type === 'join') {
    if (room.closed) throw new HttpError(410, 'Ce salon a été fermé.', 'ROOM_GONE');
    if (room.banned?.includes(user)) throw new HttpError(403, 'Vous avez été exclu de ce salon.');
    if (member >= 0) return projection(command.code, data.version, room, user);
    if (room.game)
      throw new HttpError(
        409,
        'Cette partie a commencé. Pour retrouver votre place, utilisez le même navigateur et le même profil que lors de votre arrivée. Le pseudo ne suffit pas.',
        'IDENTITY_REQUIRED',
      );
    if (room.people.length >= room.capacity)
      throw new HttpError(409, 'Ce salon est complet ou la partie a commencé.');
    room.people.push({ id: user, name: command.name });
  } else {
    if (member < 0)
      throw new HttpError(403, 'Vous ne faites plus partie de ce salon.', 'NOT_MEMBER');
    if (command.type === 'leave' || command.type === 'presence') {
      if (command.version !== data.version)
        throw new HttpError(409, 'La partie a changé. Synchronisez puis réessayez.');
      const result =
        command.type === 'leave'
          ? await db.rpc('leave_game_room', {
              p_code: command.code,
              p_user: user,
              p_connection: command.connection,
              p_version: command.version,
              p_state: leaveTable(room, user),
            })
          : await db.rpc('touch_room_presence', {
              p_code: command.code,
              p_user: user,
              p_connection: command.connection,
              p_version: command.version,
              p_active: command.active,
            });
      if (result.error)
        throw new HttpError(
          503,
          'Connexion au salon indisponible. Vérifier la migration 202611180004.',
        );
      if (!result.data)
        throw new HttpError(409, 'La partie a changé. Synchronisez puis réessayez.');
      if (command.type === 'leave') return { left: true, resumable: Boolean(room.game) };
      return projection(command.code, data.version, room, user);
    }
    if (command.type === 'sync') return projection(command.code, data.version, room, user);
    if (command.type === 'chat') {
      await limit(`chat:${user}`, 12);
      const { error: chatError } = await db.rpc('append_room_message', {
        p_code: command.code,
        p_user: user,
        p_id: command.id,
        p_name: room.people[member].name,
        p_text: command.text,
      });
      if (chatError) throw new HttpError(503, 'Message non envoyé. Vérifier la migration du chat.');
      return projection(command.code, data.version, room, user);
    }
    if (command.version !== data.version)
      throw new HttpError(409, 'La partie a changé. Actualisez avant de jouer.');
    if (command.type === 'swap-seats') {
      if (user !== room.host) throw new HttpError(403, "Seul l'hôte peut composer les équipes.");
      if (room.game || room.capacity < 4 || room.people.length !== room.capacity)
        throw new HttpError(409, 'Le salon doit être complet et en attente.');
      const { seat, target } = command;
      if (
        !room.people[seat] ||
        !room.people[target] ||
        seat % (room.capacity / 2) === target % (room.capacity / 2)
      )
        throw new HttpError(400, 'Choisissez deux joueurs dans des équipes différentes.');
      [room.people[seat], room.people[target]] = [room.people[target], room.people[seat]];
    } else if (command.type === 'kick') {
      try {
        Object.assign(room, excludeGuest(room, user, command.seat));
      } catch (e) {
        throw new HttpError(403, (e as Error).message);
      }
    } else if (command.type === 'bot-add' || command.type === 'bot-remove') {
      if (room.host !== user || room.game)
        throw new HttpError(403, 'Seul le créateur peut modifier les bots avant le début.');
      if (command.type === 'bot-add') {
        if (room.people.length >= room.capacity) throw new HttpError(409, 'Salon complet.');
        room.people.push({
          id: `bot:${randomUUID()}`,
          name: `Bot ${room.people.filter((p) => p.bot).length + 1}`,
          bot: true,
        });
      } else {
        if (!room.people[command.seat]?.bot)
          throw new HttpError(400, 'Cette place ne contient pas de bot.');
        room.people.splice(command.seat, 1);
      }
    } else if (command.type === 'start') {
      if (room.host !== user || room.game || room.people.length !== room.capacity)
        throw new HttpError(409, "Seul l'hôte peut commencer lorsque le salon est complet.");
      room.game = createGame(room.people, random, { jokers: room.jokers });
    } else {
      if (!room.game) throw new HttpError(409, "La partie n'a pas commencé.");
      try {
        if (command.type === 'bot-tick') {
          if (pendingBot(room.game) < 0) return projection(command.code, data.version, room, user);
          room.game = stepBot(room.game, random);
        } else if (command.type === 'discard-hand')
          room.game = discardHand(room.game, member, random);
        else
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
  if (!committed) throw new HttpError(409, "Un autre joueur vient d'agir. Actualisez la partie.");
  return projection(command.code, data.version + 1, room, user);
}
