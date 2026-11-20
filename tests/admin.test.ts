import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminCommandSchema, botCards, isAdmin } from '../src/server/admin-access';
import { createGame, viewFor } from '../src/game/engine';
import type { Room } from '../src/game/room';
const owner = '00000000-0000-4000-8000-000000000001';
const outsider = '00000000-0000-4000-8000-000000000002';
test('admin : refus par défaut, UUID exact vérifié et commandes strictes', () => {
  assert.equal(isAdmin(owner, undefined), false);
  assert.equal(isAdmin(outsider, owner), false);
  assert.equal(isAdmin('', owner), false);
  assert.equal(isAdmin('admin', 'admin'), false);
  assert.equal(isAdmin(owner, ` ${owner},${outsider} `), true);
  assert.equal(isAdmin(owner, `${owner}0`), false);
  assert.equal(adminCommandSchema.safeParse({ type: 'list', user: owner }).success, false);
  assert.equal(adminCommandSchema.safeParse({ type: 'delete', code: 'ABCDEFGH' }).success, false);
  assert.equal(
    adminCommandSchema.safeParse({ type: 'delete', code: 'ABCDEFGH', version: -1 }).success,
    false,
  );
  assert.equal(
    adminCommandSchema.safeParse({ type: 'delete', code: 'ABCDEFGH', version: 2 }).success,
    true,
  );
  assert.equal(
    adminCommandSchema.safeParse({ type: 'inspect', code: 'ABCDEFGH', hands: true }).success,
    false,
  );
});
test('admin : projection limitée aux mains des bots, aucune main humaine ni choix échange', () => {
  const game = createGame(
    [
      { id: owner, name: 'Humain' },
      { id: 'bot', name: 'Bot', bot: true },
    ],
    () => 0.5,
  );
  game.exchanges[1] = 0;
  const room: Room = { host: owner, people: game.players, capacity: 2, game };
  const before = structuredClone(room);
  const result = botCards(room);
  assert.deepEqual(result, [{ name: 'Bot', cards: game.hands[1] }]);
  result[0].cards.pop();
  assert.deepEqual(room, before);
  const ordinary = viewFor(game, owner);
  assert.equal('bots' in ordinary, false);
  assert.equal('hands' in ordinary, false);
  assert.equal('exchanges' in ordinary, false);
  assert.equal('deck' in ordinary, false);
  assert.deepEqual(botCards({ ...room, game: null }), []);
});
