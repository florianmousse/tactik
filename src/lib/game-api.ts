'use client';
import type { Session } from '@supabase/supabase-js';
import type { Command } from '@/server/schema';
import type { RoomView, RoomList } from '@/game/room';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type CommandResult<T extends Command> = T extends { type: 'list' } ? RoomList : RoomView;
export async function requestGame<T extends Command>(
  command: T,
  session: Session,
): Promise<CommandResult<T>> {
  let response: Response;
  try {
    response = await fetch('/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(0, 'Connexion interrompue. Synchroniser avant de réessayer.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, 'Réponse du serveur illisible. Réessayer.');
  }
  if (!response.ok) throw new ApiError(response.status, data.error || 'Requête refusée.');
  return data as CommandResult<T>;
}
