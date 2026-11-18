export const COLORS = ['coral', 'gold', 'blue', 'green', 'ink', 'ivory'] as const;
export type Color = (typeof COLORS)[number];
export type Card = 1 | 2 | 3 | 5 | 6 | 8 | 9 | 10 | 12 | -4 | 7 | 'swap';
export const CARDS: Card[] = [1, 2, 3, -4, 5, 6, 7, 8, 9, 10, 'swap', 12];
export type Piece = { id: string; color: number; position: number; stake: boolean };
// position: -1 reserve, 0..trackLength-1 track, trackLength..trackLength+3 home.
export type Player = { id: string; name: string; colors: number[]; team: number };
export type Move =
  | { kind: 'start'; piece: string }
  | { kind: 'move'; piece: string; steps: number; home?: boolean }
  | { kind: 'swap'; piece: string; target: string };
export type Play = { cardIndex: number; moves: Move[] };
export type Game = {
  players: Player[];
  pieces: Piece[];
  hands: Card[][];
  deck: Card[];
  discard: Card[];
  phase: 'exchange' | 'play' | 'finished';
  exchanges: (number | null)[];
  turn: number;
  dealer: number;
  winner: number | null;
  log: string[];
  round: number;
};
export type View = Omit<Game, 'hands' | 'deck' | 'exchanges'> & {
  hand: Card[];
  handCounts: number[];
  exchanged: boolean[];
  deckCount: number;
  me: number;
  options: Play[];
};
