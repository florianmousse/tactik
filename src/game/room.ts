import type { Capacity, Game, Person, View } from './types';
export type ChatMessage = {
  id: string;
  seat: number;
  name: string;
  text: string;
  at: string;
  me: boolean;
};
export type Room = {
  host: string;
  public?: boolean;
  banned?: string[];
  closed?: boolean;
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
  people: { name: string; me: boolean; bot: boolean; presence: Presence }[];
  game: View | null;
  jokers: boolean;
  messages: ChatMessage[];
};

export type PublicRoom = {
  code: string;
  name: string;
  capacity: number;
  players: number;
  jokers: boolean;
};
export type RoomList = { rooms: PublicRoom[] };
export type Presence = 'online' | 'away' | 'offline' | 'bot';
export type LeaveResult = { left: true; resumable: boolean };
