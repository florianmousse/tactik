import type { Game, View } from './types';
export type Room = {
  host: string;
  capacity: 2 | 3 | 4 | 6;
  people: { id: string; name: string }[];
  game: Game | null;
};
export type RoomView = {
  code: string;
  version: number;
  host: boolean;
  capacity: number;
  people: { name: string; me: boolean }[];
  game: View | null;
};
