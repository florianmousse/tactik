import type { Command } from '../server/schema';
import { ApiError } from './game-api';

export function canRetryAfterRefresh(command: Command) {
  return command.type === 'sync' || command.type === 'list';
}
export function hasLostRoomAccess(error: unknown) {
  return error instanceof ApiError && (error.code === 'NOT_MEMBER' || error.code === 'ROOM_GONE');
}
