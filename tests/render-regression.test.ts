import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Board } from '../src/components/board';
import { createGame, play, viewFor } from '../src/game/engine';
import type { Play } from '../src/game/types';
import { GameApp } from '../src/components/game-app';

test('plateau : un aperçu du tour précédent ne plante pas après une entrée en maison', () => {
  const game = createGame(
    Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    () => 0.4,
  );
  game.phase = 'play';
  game.turn = 0;
  game.hands[0] = [3, 2];
  game.pieces[0].position = 63;
  const action: Play = {
    cardIndex: 0,
    moves: [{ kind: 'move', piece: game.pieces[0].id, steps: 3, home: true }],
  };
  const after = viewFor(
    play(game, 0, action, () => 0.4),
    'p0',
  );
  // React receives the new board before the effect clears the previous preview.
  assert.doesNotThrow(() =>
    renderToStaticMarkup(
      createElement(Board, {
        game: after,
        playable: [],
        destinations: action.moves,
        onPiece: () => {},
      }),
    ),
  );
});
test('premier rendu : HTML déterministe, avant stockage navigateur et session', () => {
  const first = renderToStaticMarkup(createElement(GameApp));
  const second = renderToStaticMarkup(createElement(GameApp));
  assert.equal(first, second);
  assert.ok(first.includes('Votre pseudo'));
});
