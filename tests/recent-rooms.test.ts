import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRoom } from '../src/lib/recent-rooms';
import { createGame, viewFor } from '../src/game/engine';
import type { RoomView } from '../src/game/room';

test('parties recentes : attente, echange, victoire de l equipe zero et informations sans main', () => {
  const game = createGame(
    Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `Joueur ${i}` })),
    () => 0.5,
  );
  const room: RoomView = {
    code: 'ABCDEFGH',
    version: 1,
    host: true,
    capacity: 4,
    jokers: true,
    people: game.players.map((player, i) => ({
      name: player.name,
      me: i === 0,
      bot: false,
      presence: 'online',
    })),
    game: null,
    messages: [],
  };
  assert.equal(summarizeRoom(room).status, 'En attente de joueurs');
  room.game = viewFor(game, 'p0');
  assert.equal(summarizeRoom(room).status, 'En cours - Échange de cartes');
  game.phase = 'finished';
  game.winner = 0;
  room.game = viewFor(game, 'p0');
  const summary = summarizeRoom(room);
  assert.equal(summary.finished, true);
  const winners = game.players.filter((player) => player.team === 0);
  for (const winner of winners) assert.ok(summary.status.includes(winner.name));
  assert.ok(summary.me.includes('Joueur 0'));
  assert.ok(summary.partner.length > 0);
  assert.equal('hand' in summary, false);
  assert.equal('game' in summary, false);
});
