import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema } from '../src/server/schema';
test('frontière HTTP : champs inconnus, téléportation, index et tailles rejetés', () => {
  const create = { type: 'create', name: 'Alix', capacity: 4 };
  assert.ok(commandSchema.safeParse(create).success);
  for (const invalid of [
    { ...create, host: 'other' },
    { ...create, name: '<script>alert(1)</script>' },
    { ...create, name: 'x'.repeat(25) },
    { ...create, capacity: 5 },
  ])
    assert.equal(commandSchema.safeParse(invalid).success, false);
  const play = {
    type: 'play',
    code: 'AABBCCDDEEFF',
    version: 3,
    play: { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 2 }] },
  };
  assert.ok(commandSchema.safeParse(play).success);
  assert.equal(commandSchema.safeParse({ ...play, version: -1 }).success, false);
  assert.equal(
    commandSchema.safeParse({
      ...play,
      play: { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 99 }] },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      ...play,
      play: { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 2, position: 42 }] },
    }).success,
    false,
  );
});

test('salons publics : codes courts et anciens, exclusion versionnée et champs stricts', () => {
  assert.ok(commandSchema.safeParse({ type: 'list' }).success);
  assert.ok(
    commandSchema.safeParse({ type: 'create', name: 'Alix', capacity: 6, public: true }).success,
  );
  for (const code of ['ABCDEFGH', 'AABBCCDDEEFF']) {
    assert.ok(commandSchema.safeParse({ type: 'join', code, name: 'Alix' }).success);
    assert.ok(commandSchema.safeParse({ type: 'kick', code, version: 3, seat: 1 }).success);
    for (const extra of [{ seat: 0 }, { version: undefined }, { user: 'other' }])
      assert.equal(
        commandSchema.safeParse({ type: 'kick', code, version: 3, seat: 1, ...extra }).success,
        false,
      );
  }
  assert.equal(commandSchema.safeParse({ type: 'list', state: true }).success, false);
  assert.equal(commandSchema.safeParse({ type: 'join', code: 'ABC', name: 'Alix' }).success, false);
});

test('exclusion : hote seul, avant lancement, jamais soi ou un bot, sans mutation', async () => {
  const { excludeGuest } = await import('../src/server/room-access');
  const { createGame } = await import('../src/game/engine');
  const room = {
    host: 'host',
    capacity: 4 as const,
    game: null,
    people: [
      { id: 'host', name: 'Hote' },
      { id: 'guest', name: 'Invite' },
      { id: 'bot', name: 'Bot', bot: true },
    ],
  };
  const before = structuredClone(room);
  for (const [user, seat] of [
    ['guest', 1],
    ['outsider', 1],
    ['host', 0],
    ['host', 2],
    ['host', 7],
  ] as const)
    assert.throws(() => excludeGuest(room, user, seat));
  assert.throws(() =>
    excludeGuest({ ...room, game: createGame(room.people.slice(0, 2), () => 0.4) }, 'host', 1),
  );
  const next = excludeGuest(room, 'host', 1);
  assert.deepEqual(next.banned, ['guest']);
  assert.equal(
    next.people.some((p) => p.id === 'guest'),
    false,
  );
  assert.deepEqual(room, before);
});
