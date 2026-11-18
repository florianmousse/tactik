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
    { ...create, capacity: 8 },
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
