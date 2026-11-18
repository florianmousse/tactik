import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play, viewFor } from '../src/game/engine';
import { moveDestination } from '../src/game/move-preview';

test('destinations : sortie, recul, maison, permutation et 7 correspondent au moteur', () => {
  for (const card of [1, -4, 7, 'swap', 12] as const) {
    const game = createGame(
      Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
      () => 0.4,
    );
    game.phase = 'play';
    game.turn = 0;
    game.hands[0] = [card, 2];
    game.pieces.find((p) => p.id === '0-0')!.position = 61;
    game.pieces.find((p) => p.id === '0-1')!.position = 12;
    game.pieces.find((p) => p.id === '2-0')!.position = 20;
    const view = viewFor(game, 'p0');
    const options = view.options.filter((p) => p.cardIndex === 0);
    assert.ok(options.length);
    for (const option of options) {
      const result = play(game, 0, option, () => 0.4);
      for (const move of option.moves) {
        const actual = result.pieces.find((p) => p.id === move.piece)!;
        // A later segment of a 7 can capture an earlier moved piece.
        if (actual.position >= 0)
          assert.equal(moveDestination(view, move).position, actual.position);
      }
    }
    assert.deepEqual(view.pieces, game.pieces);
  }
});
