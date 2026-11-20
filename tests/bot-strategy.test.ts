import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  discardHand,
  exchange,
  play,
  startPosition,
  trackLength,
  viewFor,
} from '../src/game/engine';
import { chooseBotExchange, chooseBotPlay } from '../src/game/bots';
import { cardChance, emptyKnowledge } from '../src/game/card-knowledge';
import type { Game } from '../src/game/types';
function setup() {
  return createGame(
    Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })),
    () => 0.4,
  );
}
function place(g: Game, id: string, position: number) {
  Object.assign(
    g.pieces.find((p) => p.id === id)!,
    { position, stake: false },
  );
}
function lastPiece(g: Game, color: number, distance: number) {
  const length = trackLength(g);
  for (let i = 1; i < 4; i++) place(g, `${color}-${i}`, length + i);
  place(g, `${color}-0`, (startPosition(g, color) - distance + 1 + length) % length);
}
test('échange : donne le 8 exact pour rentrer le dernier pion du partenaire', () => {
  const g = setup();
  lastPiece(g, 1, 8);
  g.hands[0] = [5, 8, 6];
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 8);
});
test('échange : donne le 2 qui libère le fond de maison', () => {
  const g = setup(),
    length = trackLength(g);
  place(g, '1-0', length + 1);
  g.hands[0] = [5, 2, 6];
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 2);
});
test('échange : le 7 doit être utilisable entièrement, avec répartition légale', () => {
  const g = setup(),
    length = trackLength(g),
    start = startPosition(g, 1);
  place(g, '1-0', length);
  place(g, '1-1', start);
  place(g, '1-2', (start - 2 + length) % length);
  g.hands[0] = [5, 7, 6];
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 7);
  lastPiece(g, 1, 2);
  g.hands[0] = [7, 2];
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 2);
  g.phase = 'play';
  g.turn = 2;
  g.hands[2] = [7];
  assert.throws(() =>
    play(
      g,
      2,
      { cardIndex: 0, moves: [{ kind: 'move', piece: '1-0', steps: 2, home: true }] },
      () => 0.4,
    ),
  );
});

function sharedEndgame() {
  const g = setup(),
    length = trackLength(g);
  for (let i = 0; i < 4; i++) place(g, `0-${i}`, length + i);
  lastPiece(g, 1, 8);
  g.phase = 'play';
  g.turn = 0;
  g.hands[0] = [5, 6];
  g.hands[2] = [9]; // Actual hidden contents are deliberately unhelpful.
  return g;
}
test('fin commune : évite 6 + 2 quand les quatre 2 sont déjà sortis', () => {
  const g = sharedEndgame();
  g.memories![0].spent = { 2: 4 };
  const before = structuredClone(g);
  const choice = chooseBotPlay(viewFor(g, 'p0'), () => 0);
  assert.equal(g.hands[0][choice.cardIndex], 5);
  assert.doesNotThrow(() => play(g, 0, choice, () => 0.4));
  assert.deepEqual(g, before);
  g.memories![0].spent = { 3: 4 };
  assert.equal(g.hands[0][chooseBotPlay(viewFor(g, 'p0'), () => 0).cardIndex], 6);
});
test('fin commune : exploite le 3 donné au partenaire sans lire sa main', () => {
  const g = sharedEndgame();
  g.memories![0].known = [{ player: 2, card: 3 }];
  g.memories![0].exchange = { given: 3, received: 6, recipient: 2, sender: 2, round: g.round };
  const first = chooseBotPlay(viewFor(g, 'p0'), () => 0);
  assert.equal(g.hands[0][first.cardIndex], 5);
  g.hands[2] = [12];
  assert.deepEqual(
    chooseBotPlay(viewFor(g, 'p0'), () => 0),
    first,
  );
});
test('mémoire : échange simultané privé, donné/reçu et retrait après carte jouée', () => {
  let g = setup();
  g.hands = [
    [3, 5],
    [8, 9],
    [2, 6],
    [10, 12],
  ];
  const before = structuredClone(g);
  for (let i = 0; i < 3; i++) {
    g = exchange(g, i, 0);
    for (let j = 0; j < 4; j++) assert.equal(viewFor(g, `p${j}`).knowledge?.exchange, undefined);
  }
  assert.equal(before.exchanges[0], null);
  g = exchange(g, 3, 0);
  g = JSON.parse(JSON.stringify(g)) as Game;
  const own = viewFor(g, 'p0');
  assert.deepEqual(own.knowledge?.exchange, {
    given: 3,
    received: 2,
    sender: 2,
    recipient: 2,
    round: 1,
  });
  assert.deepEqual(own.knowledge?.known, [{ player: 2, card: 3 }]);
  assert.equal('memories' in own, false);
  assert.deepEqual(viewFor(g, 'p1').knowledge?.exchange, {
    given: 8,
    received: 10,
    sender: 3,
    recipient: 3,
    round: 1,
  });
  own.knowledge!.known.length = 0;
  assert.equal(g.memories![0].known.length, 1);
  g.phase = 'play';
  g.turn = 2;
  place(g, '1-0', 34);
  g = play(g, 2, { cardIndex: 1, moves: [{ kind: 'move', piece: '1-0', steps: 3 }] }, () => 0.4);
  assert.deepEqual(g.memories![0].known, []);
  assert.equal(g.memories![0].spent[3], 1);
  assert.equal(g.memories![0].exchange?.given, 3);
});
test('mémoire : défausse complète inconnue des autres, nouvelle donne et remélange', () => {
  let g = setup();
  g.phase = 'play';
  g.turn = 0;
  g.hands[0] = [2, 3];
  g.memories![1].known = [{ player: 0, card: 2 }];
  const before = structuredClone(g);
  g = discardHand(g, 0, () => 0.4);
  assert.deepEqual(g.memories![0].spent, { 2: 1, 3: 1 });
  assert.deepEqual(g.memories![1].spent, {});
  assert.deepEqual(g.memories![1].known, []);
  assert.deepEqual(before.hands[0], [2, 3]);
  g.hands = [[2], [], [], []];
  g.turn = 0;
  g.memories![0].exchange = { given: 3, received: 2, recipient: 2, sender: 2, round: 1 };
  g = discardHand(g, 0, () => 0.4);
  assert.equal(g.round, 2);
  assert.equal(g.memories![0].exchange, undefined);
  assert.equal(g.memories![0].spent[2], 2);
  g.hands = [[2], [], [], []];
  g.turn = 0;
  g.phase = 'play';
  g.deck = [];
  g.discard = Array.from({ length: 30 }, () => 3);
  g = discardHand(g, 0, () => 0.4);
  assert.deepEqual(g.memories, g.players.map(emptyKnowledge));
});
test('comptage : probabilité prudente, double paquet, Joker réel et anciennes sauvegardes', () => {
  const g = sharedEndgame();
  g.memories![0].spent = { 3: 4 };
  let view = viewFor(g, 'p0');
  assert.equal(cardChance(view, 2, [3]), 0);
  g.memories![0].spent = { 3: 3 };
  view = viewFor(g, 'p0');
  assert.ok(cardChance(view, 2, [3]) > 0 && cardChance(view, 2, [3]) < 1);
  view.discard = Array.from({ length: 4 }, () => 3);
  assert.equal(cardChance(view, 2, [3]), cardChance(viewFor(g, 'p0'), 2, [3]));
  const eight = createGame(
    Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    () => 0.4,
    { jokers: true },
  );
  eight.hands[0] = [5];
  eight.memories![0].spent = { 3: 4, joker: 1 };
  assert.ok(cardChance(viewFor(eight, 'p0'), 2, [3]) > 0);
  assert.ok(cardChance(viewFor(eight, 'p0'), 2, ['joker']) > 0);
  eight.memories![0].spent = { 3: 8, joker: 2 };
  assert.equal(cardChance(viewFor(eight, 'p0'), 2, [3, 'joker']), 0);
  delete g.memories;
  assert.deepEqual(viewFor(g, 'p0').knowledge, emptyKnowledge());
  assert.doesNotThrow(() => chooseBotPlay(viewFor(g, 'p0'), () => 0));
});

test('échange : préfère 6 + 2 à 5 + 3 quand tous les 3 sont sortis', () => {
  const g = sharedEndgame();
  g.phase = 'exchange';
  g.hands[2] = [9, 10, 12, 8];
  g.memories![0].spent = { 3: 4 };
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 6);
  g.memories![0].spent = { 2: 4 };
  assert.equal(g.hands[0][chooseBotExchange(viewFor(g, 'p0'))], 5);
});

test('mémoire : destinataire et expéditeur corrects à 2, 3 et 8 joueurs', () => {
  for (const count of [2, 3, 8]) {
    let g = createGame(
      Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
      () => 0.4,
    );
    const gifts = g.hands.map((hand) => hand[0]);
    for (let actor = 0; actor < count; actor++) g = exchange(g, actor, 0);
    for (let actor = 0; actor < count; actor++) {
      const recipient = (actor + (count <= 3 ? 1 : count / 2)) % count;
      const sender = count <= 3 ? (actor + count - 1) % count : recipient;
      assert.deepEqual(viewFor(g, `p${actor}`).knowledge?.exchange, {
        given: gifts[actor],
        received: gifts[sender],
        recipient,
        sender,
        round: 1,
      });
    }
  }
});
test('mémoire : Joker annoncé comme 8 compté comme Joker, pas comme 8', () => {
  const g = setup();
  g.phase = 'play';
  g.turn = 0;
  g.jokers = true;
  g.hands[0] = ['joker'];
  place(g, '0-0', 1);
  const next = play(
    g,
    0,
    { cardIndex: 0, as: 8, moves: [{ kind: 'move', piece: '0-0', steps: 8 }] },
    () => 0.4,
  );
  assert.equal(next.memories![1].spent.joker, 1);
  assert.equal(next.memories![1].spent[8], undefined);
});
