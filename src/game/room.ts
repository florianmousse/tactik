import type { Capacity, Game, Person, View } from './types';
export type ChatMessage = { id: string; name: string; text: string; at: string; me: boolean };
export type Room = {
  host: string;
  capacity: Capacity;
  people: Person[];
  jokers?: boolean;
  game: Game | null;
};
export type RoomView = {
  code: string;
  version: number;
  host: boolean;
  capacity: number;
  people: { name: string; me: boolean; bot: boolean }[];
  game: View | null;
  jokers: boolean;
  messages: ChatMessage[];
};
