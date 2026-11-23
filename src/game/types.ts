import type { GameStats } from './stats';
export const COLORS = [
  'red',
  'yellow',
  'blue',
  'green',
  'black',
  'white',
  'purple',
  'orange',
] as const;
export type Color = (typeof COLORS)[number];
export type BaseCard = 1 | 2 | 3 | 5 | 6 | 8 | 9 | 10 | 12 | -4 | 7 | 'swap';
export type Card = BaseCard | 'joker';
export const CARDS: BaseCard[] = [1, 2, 3, -4, 5, 6, 7, 8, 9, 10, 'swap', 12];
export type Capacity = 2 | 3 | 4 | 6 | 8;
export type Person = { id: string; name: string; bot?: boolean };
export type Piece = { id: string; color: number; position: number; stake: boolean };
// position: -1 reserve, 0..trackLength-1 track, trackLength..trackLength+3 home.
export type Player = Person & { colors: number[]; team: number };
export type Move =
  | { kind: 'start'; piece: string }
  | { kind: 'move'; piece: string; steps: number; home?: boolean }
  | { kind: 'swap'; piece: string; target: string };
export type Play = { cardIndex: number; moves: Move[]; as?: BaseCard };
export type PieceChange = {
  piece: string;
  color: number;
  from: number;
  to: number;
  captured: boolean;
  step: number;
};
export type TurnRecord = {
  id: number;
  round: number;
  actor: number;
  card: Card | null;
  as?: BaseCard;
  kind: 'play' | 'discard' | 'discard-hand';
  changes: PieceChange[];
};
export type CardKnowledge = {
  // Cards observed leaving hands since the last discard reshuffle.
  spent: Partial<Record<Card, number>>;
  known: { player: number; card: Card }[];
  exchange?: { given: Card; received: Card; recipient: number; sender: number; round: number };
};
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
  jokers?: boolean;
  stats?: GameStats;
  history?: TurnRecord[];
  memories?: CardKnowledge[];
};
export type View = Omit<Game, 'hands' | 'deck' | 'exchanges' | 'memories'> & {
  knowledge?: CardKnowledge;
  hand: Card[];
  handCounts: number[];
  exchanged: boolean[];
  deckCount: number;
  me: number;
  options: Play[];
  canDiscardHand: boolean;
};
