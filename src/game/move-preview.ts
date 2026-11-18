import { startPosition, trackLength } from './engine';
import type { Move, View } from './types';

// Display only: callers supply moves from the private projection's legal options.
export function moveDestination(view: View, move: Move): { color: number; position: number } {
  const piece = view.pieces.find((p) => p.id === move.piece)!;
  const length = trackLength(view);
  let position = piece.position;
  if (move.kind === 'start') position = startPosition(view, piece.color);
  else if (move.kind === 'swap') position = view.pieces.find((p) => p.id === move.target)!.position;
  else
    for (let i = 0; i < Math.abs(move.steps); i++) {
      if (position >= length) position++;
      else if (move.home && move.steps > 0 && position === startPosition(view, piece.color))
        position = length;
      else position = (position + Math.sign(move.steps) + length) % length;
    }
  return { color: piece.color, position };
}
