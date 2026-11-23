import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, discardHand, play, simulateMoves, viewFor } from '../src/game/engine';
import { chooseBotExchange, chooseBotPlay } from '../src/game/bots';
import { turnOrder } from '../src/game/turn-order';
import { unreadMessages } from '../src/lib/chat-unread';
import { commandSchema } from '../src/server/schema';
import type { Game } from '../src/game/types';

function setup() {
  const game = createGame(
    Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: i > 0 })),
    () => 0.4,
  );
  game.phase = 'play';
  game.turn = 0;
  game.hands[0] = [2];
  return game;
}
const piece = (game: Game, id: string, position: number, stake = false) =>
  Object.assign(
    game.pieces.find((p) => p.id === id)!,
    { position, stake },
  );

test('bot : évite de capturer ses pions et ceux de son partenaire si un coup sûr existe', () => {
  for (const target of ['0-1', '1-0']) {
    const game = setup();
    piece(game, '0-0', 1);
    piece(game, target, 3);
    if (target === '1-0') piece(game, '0-1', 10);
    const view = viewFor(game, 'p0');
    const choice = chooseBotPlay(view, () => 0);
    assert.notEqual(choice.moves[0].piece, '0-0');
    assert.doesNotThrow(() => play(game, 0, choice, () => 0.4));
  }
});
test('bot : une capture de soi forcée reste jouable, passer est interdit', () => {
  const game = setup();
  piece(game, '0-0', 1);
  piece(game, '0-1', 3);
  piece(game, '2-0', 5, true);
  const choice = chooseBotPlay(viewFor(game, 'p0'), () => 0);
  assert.equal(choice.moves[0].piece, '0-0');
  assert.doesNotThrow(() => play(game, 0, choice, () => 0.4));
  assert.throws(() => play(game, 0, { cardIndex: 0, moves: [] }, () => 0.4));
});
test('bot : le 7 évalue aussi les captures sur le chemin', () => {
  const game = setup();
  game.hands[0] = [7];
  piece(game, '0-0', 1);
  piece(game, '1-0', 3);
  piece(game, '0-1', 20);
  const view = viewFor(game, 'p0');
  const choice = chooseBotPlay(view, () => 0);
  assert.ok(
    simulateMoves(view, 0, choice.moves, true).changes.every(
      (c) => !c.captured || (c.color !== 0 && c.color !== 1),
    ),
  );
  assert.doesNotThrow(() => play(game, 0, choice, () => 0.4));
});
test('bot : donne un démarrage au partenaire en réserve et garde sa seule sortie si nécessaire', () => {
  const game = setup();
  game.phase = 'exchange';
  game.hands[0] = [5, 1, 10, 2];
  assert.equal(game.hands[0][chooseBotExchange(viewFor(game, 'p0'))], 1);
  game.hands[0] = [5, 1, 2];
  assert.equal(game.hands[0][chooseBotExchange(viewFor(game, 'p0'))], 5);
  piece(game, '0-0', 10);
  piece(game, '0-1', 20);
  assert.equal(game.hands[0][chooseBotExchange(viewFor(game, 'p0'))], 1);
  piece(game, '1-0', 32, true);
  assert.equal(game.hands[0][chooseBotExchange(viewFor(game, 'p0'))], 5);
});
test('historique : positions de permutation et captures du 7, sans état privé', () => {
  const game = setup();
  game.hands[0] = ['swap', 2];
  piece(game, '0-0', 1);
  piece(game, '2-0', 10);
  const before = structuredClone(game);
  const swapped = play(
    game,
    0,
    { cardIndex: 0, moves: [{ kind: 'swap', piece: '0-0', target: '2-0' }] },
    () => 0.4,
  );
  assert.deepEqual(
    swapped.history?.[0].changes.map((c) => [c.piece, c.from, c.to]),
    [
      ['0-0', 1, 10],
      ['2-0', 10, 1],
    ],
  );
  assert.deepEqual(game, before);
  game.hands[0] = [7];
  piece(game, '2-0', 3);
  const seven = play(
    game,
    0,
    { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 7 }] },
    () => 0.4,
  );
  assert.ok(
    seven.history?.[0].changes.some(
      (c) => c.piece === '2-0' && c.from === 3 && c.to === -1 && c.captured,
    ),
  );
  const projection = viewFor(seven, 'p1');
  for (const key of ['hands', 'deck', 'exchanges', 'botHands'])
    assert.equal(key in projection, false);
  assert.ok(projection.history?.length);
  assert.equal(
    commandSchema.safeParse({ type: 'create', name: 'Test', capacity: 4, showBotHands: true })
      .success,
    false,
  );
});
test('historique : anciens salons acceptés, défausse complète sans cartes exposées, rétention bornée', () => {
  const game = setup();
  game.hands[0] = [2, 3];
  delete game.history;
  const discarded = discardHand(game, 0, () => 0.4);
  assert.equal(discarded.history?.[0].card, null);
  assert.equal(discarded.history?.[0].kind, 'discard-hand');
  game.history = Array.from({ length: 40 }, (_, i) => ({
    id: 40 - i,
    round: 1,
    actor: 0,
    card: null,
    kind: 'discard-hand',
    changes: [],
  }));
  const next = discardHand(game, 0, () => 0.4);
  assert.equal(next.history?.length, 40);
  assert.equal(next.history?.[0].id, 41);
});
test('ordre : échange, prochain joueur avec cartes, prochaine donne et dernier coup', () => {
  const game = setup();
  game.phase = 'exchange';
  assert.equal(turnOrder(viewFor(game, 'p0')).next, 1);
  game.phase = 'play';
  game.hands[1] = [];
  game.hands[2] = [2];
  assert.equal(turnOrder(viewFor(game, 'p0')).next, 2);
  assert.equal(turnOrder(viewFor(game, 'p0')).nextDeal, 2);
  game.hands[2] = [];
  game.hands[3] = [];
  assert.equal(turnOrder(viewFor(game, 'p0')).next, null);
});
test('chat : nouveaux UUID, propres messages exclus, réception à longueur constante', () => {
  const messages = [
    { id: 'new', seat: 1, name: 'A', text: 'Bonjour', at: '', me: false },
    { id: 'own', seat: 0, name: 'Moi', text: 'Salut', at: '', me: true },
  ];
  assert.deepEqual(
    unreadMessages(messages, ['old']).map((m) => m.id),
    ['new'],
  );
  assert.deepEqual(unreadMessages(messages, ['new']), []);
});
