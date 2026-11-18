import type { ChatMessage } from '../game/room';
export function unreadMessages(messages: ChatMessage[], seen: readonly string[]): ChatMessage[] {
  const ids = new Set(seen);
  return messages.filter((m) => !m.me && !ids.has(m.id));
}
