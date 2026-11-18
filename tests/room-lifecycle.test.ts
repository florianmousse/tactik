import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveTable } from '../src/server/room-access';
import { createGame, colorOrder, startPosition } from '../src/game/engine';
import { boardLayout, boardOrientation } from '../src/game/board-layout';
import { commandSchema } from '../src/server/schema';
import { ApiError } from '../src/lib/game-api';
import { canRetryAfterRefresh, hasLostRoomAccess } from '../src/lib/room-connection';
import { parseRecentRooms, rememberRoom } from '../src/lib/recent-rooms';
import type { Room } from '../src/game/room';

const people = [
  { id: 'host', name: 'Hote' },
  { id: 'guest', name: 'Invite' },
];
const room: Room = { host: 'host', public: true, capacity: 4, game: null, people };
test('départ : siège libéré, hôte transféré, dernier humain ferme le salon', () => {
  const before = structuredClone(room);
  assert.throws(() => leaveTable(room, 'outsider'));
  assert.deepEqual(leaveTable(room, 'guest').people, [people[0]]);
  const next = leaveTable(
    { ...room, people: [people[0], { id: 'bot', name: 'Bot', bot: true }, people[1]] },
    'host',
  );
  assert.equal(next.host, 'guest');
  assert.equal(next.people[0].id, 'guest');
  const closed = leaveTable(next, 'guest');
  assert.deepEqual(closed.people, []);
  assert.equal(closed.public, false);
  assert.equal(closed.closed, true);
  assert.deepEqual(room, before);
});
test('départ en cours : identité, main, siège et équipe conservés pour la reprise', () => {
  const game = createGame(people, () => 0.4);
  const started = { ...room, game };
  assert.deepEqual(leaveTable(started, 'host'), started);
});
test('connexion : erreur origine ou réseau ne vaut pas exclusion, aucun coup rejoué', () => {
  for (const status of [0, 401, 403, 409, 429, 503])
    assert.equal(hasLostRoomAccess(new ApiError(status, 'test')), false);
  assert.equal(hasLostRoomAccess(new ApiError(403, 'test', 'NOT_MEMBER')), true);
  assert.equal(hasLostRoomAccess(new ApiError(404, 'test', 'ROOM_GONE')), true);
  assert.equal(canRetryAfterRefresh({ type: 'sync', code: 'ABCDEFGH' }), true);
  assert.equal(
    canRetryAfterRefresh({
      type: 'play',
      code: 'ABCDEFGH',
      version: 1,
      play: { cardIndex: 0, moves: [] },
    }),
    false,
  );
  assert.equal(canRetryAfterRefresh({ type: 'join', code: 'ABCDEFGH', name: 'Test' }), false);
});
test('présence et départ : version et connexion obligatoires, identité client refusée', () => {
  const base = { code: 'ABCDEFGH', version: 0, connection: '58c727b6-d853-4d0c-8fc1-99184dca36af' };
  for (const action of [
    { ...base, type: 'leave' },
    { ...base, type: 'presence', active: true },
  ]) {
    assert.ok(commandSchema.safeParse(action).success);
    for (const extra of [{ version: undefined }, { connection: 'invalid' }, { user: 'other' }])
      assert.equal(commandSchema.safeParse({ ...action, ...extra }).success, false);
  }
});
test('salons récents : données invalides ignorées, doublons retirés, huit codes maximum', () => {
  assert.deepEqual(parseRecentRooms('broken'), []);
  assert.deepEqual(parseRecentRooms('["ABCDEFGH",42,"<script>","ABCDEFGH"]'), ['ABCDEFGH']);
  assert.deepEqual(rememberRoom('ABCDEFGH', ['AABBCCDDEEFF', 'ABCDEFGH']), [
    'ABCDEFGH',
    'AABBCCDDEEFF',
  ]);
  assert.equal(
    rememberRoom(
      'ABCDEFGH',
      Array.from({ length: 12 }, (_, i) => `AAAAAAA${String.fromCharCode(65 + i)}`),
    ).length,
    8,
  );
});
test('orientation : départ en bas pour chaque joueur, cibles et plateau restent dans le cadre', () => {
  for (const count of [2, 3, 4, 6, 8]) {
    const game = createGame(
      Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
      () => 0.4,
    );
    const before = structuredClone(game);
    const layout = boardLayout(game);
    for (const color of colorOrder(game)) {
      const oriented = boardOrientation(game, color);
      const radians = (oriented.angle * Math.PI) / 180;
      const rotate = ([x, y]: number[]) => [
        oriented.width / 2 +
          (x - layout.width / 2) * Math.cos(radians) -
          (y - layout.height / 2) * Math.sin(radians),
        oriented.height / 2 +
          (x - layout.width / 2) * Math.sin(radians) +
          (y - layout.height / 2) * Math.cos(radians),
      ];
      assert.ok(rotate(layout.track[startPosition(game, color)])[1] > oriented.height / 2);
      for (const point of [
        ...layout.track,
        ...Object.values(layout.reserves).flat(),
        ...Object.values(layout.homes).flat(),
      ]) {
        const [x, y] = rotate(point);
        assert.ok(x > 0 && x < oriented.width && y > 0 && y < oriented.height);
      }
    }
    for (const color of [0, 1])
      assert.equal(new Set(layout.reserves[color].map(([x]) => x)).size, 1);
    for (const color of [2, 3]) {
      const axis = layout.width === 584 ? 1 : 0;
      assert.equal(new Set(layout.reserves[color].map((p) => p[axis])).size, 1);
    }
    assert.deepEqual(game, before);
  }
});
