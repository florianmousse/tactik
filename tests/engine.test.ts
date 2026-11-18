import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  exchange,
  legalPlays,
  play,
  startPosition,
  trackLength,
  viewFor,
  activeColors,
} from '../src/game/engine';
import { CARDS, type Card, type Game } from '../src/game/types';
const random = () => 0.42;
function setup(count = 4) {
  const g = createGame(
    Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Joueur ${i}` })),
    random,
  );
  g.phase = 'play';
  g.turn = 0;
  return g;
}
function card(g: Game, c: Card) {
  g.hands[0] = [c, 2];
}
function piece(g: Game, color: number, n = 0) {
  return g.pieces.find((p) => p.id === `${color}-${n}`)!;
}
test('configurations : quatre pions par couleur, 48 cartes, partenaires opposés', () => {
  for (const count of [2, 3, 4, 6]) {
    const g = setup(count);
    assert.equal(g.pieces.length, count === 2 || count === 4 ? 16 : 24);
    assert.equal(g.hands.flat().length + g.deck.length, 48);
    assert.equal(g.hands[0].length, count === 2 ? 6 : 4);
    assert.deepEqual(g.players[0].colors, count < 4 ? [0, 1] : [0]);
    if (count >= 4) assert.equal(g.players[0].team, g.players[count / 2].team);
  }
  assert.throws(() => setup(5));
});
test('échanges simultanés, une seule validation, réception au partenaire', () => {
  let g = setup();
  g.phase = 'exchange';
  const original = structuredClone(g.hands);
  g = exchange(g, 0, 1);
  assert.deepEqual(g.hands, original);
  assert.throws(() => exchange(g, 0, 2));
  assert.throws(() => exchange(g, 1, -1));
  for (let i = 1; i < 4; i++) g = exchange(g, i, 0);
  assert.equal(g.phase, 'play');
  assert.equal(g.hands[2].at(-1), original[0][1]);
  assert.equal(g.hands[0].at(-1), original[2][0]);
});
test('les échanges à 2 et 3 suivent le joueur à gauche', () => {
  for (const count of [2, 3]) {
    let g = setup(count);
    g.phase = 'exchange';
    const cards = g.hands.map((h) => h[0]);
    for (let i = 0; i < count; i++) g = exchange(g, i, 0);
    for (let i = 0; i < count; i++) assert.equal(g.hands[(i + 1) % count].at(-1), cards[i]);
  }
});
test('sortie avec 1 ou 10, pieu protégé et bloquant même son propriétaire', () => {
  const g = setup();
  card(g, 1);
  const next = play(g, 0, { cardIndex: 0, moves: [{ kind: 'start', piece: '0-0' }] }, random);
  assert.equal(piece(next, 0).position, 0);
  assert.equal(piece(next, 0).stake, true);
  assert.equal(piece(g, 0).position, -1);
  g.pieces = next.pieces;
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'start', piece: '0-1' }] }, random),
  );
  piece(g, 0, 1).position = trackLength(g) - 1;
  card(g, 2);
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-1', steps: 2 }] }, random),
  );
});
test('déplacement du pieu, recul et entrée ultérieure à la maison', () => {
  const g = setup();
  const p = piece(g, 0);
  p.position = 0;
  p.stake = true;
  card(g, -4);
  let next = play(
    g,
    0,
    { cardIndex: 0, moves: [{ kind: 'move', piece: p.id, steps: -4 }] },
    random,
  );
  assert.equal(piece(next, 0).position, trackLength(g) - 4);
  assert.equal(piece(next, 0).stake, false);
  next.turn = 0;
  card(next, 5);
  next = play(
    next,
    0,
    { cardIndex: 0, moves: [{ kind: 'move', piece: p.id, steps: 5, home: true }] },
    random,
  );
  assert.equal(piece(next, 0).position, trackLength(g));
});
test('pieu interdit de maison directe et faux déplacement de carte refusé', () => {
  const g = setup();
  piece(g, 0).position = 0;
  piece(g, 0).stake = true;
  card(g, 1);
  assert.throws(() =>
    play(
      g,
      0,
      { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 1, home: true }] },
      random,
    ),
  );
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 12 }] }, random),
  );
  assert.throws(() => play(g, 1, { cardIndex: 0, moves: [] }, random));
});
test('capture à destination, y compris allié ; pas sur le chemin hors 7', () => {
  const g = setup();
  card(g, 3);
  piece(g, 0).position = 1;
  piece(g, 2).position = 2;
  piece(g, 1).position = 4;
  const next = play(
    g,
    0,
    { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 3 }] },
    random,
  );
  assert.equal(piece(next, 2).position, 2);
  assert.equal(piece(next, 1).position, -1);
});
test('maison : valeur exacte, aucun dépassement, aucune sortie', () => {
  const g = setup(),
    length = trackLength(g);
  card(g, 3);
  piece(g, 0).position = length + 1;
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 3 }] }, random),
  );
  card(g, 2);
  piece(g, 0).position = length;
  piece(g, 0, 1).position = length + 1;
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 2 }] }, random),
  );
  card(g, -4);
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: -4 }] }, random),
  );
});
test('permutation : pieu propre permis, pieu adverse et maison interdits', () => {
  const g = setup();
  card(g, 'swap');
  piece(g, 0).position = 0;
  piece(g, 0).stake = true;
  piece(g, 2).position = 8;
  const move = { kind: 'swap' as const, piece: '0-0', target: '2-0' };
  const next = play(g, 0, { cardIndex: 0, moves: [move] }, random);
  assert.equal(piece(next, 0).position, 8);
  assert.equal(piece(next, 0).stake, false);
  piece(g, 2).stake = true;
  assert.throws(() => play(g, 0, { cardIndex: 0, moves: [move] }, random));
  piece(g, 2).stake = false;
  piece(g, 2).position = trackLength(g);
  assert.throws(() => play(g, 0, { cardIndex: 0, moves: [move] }, random));
});
test('7 : partition exacte, capture en chemin, pas de réutilisation de pion', () => {
  const g = setup();
  card(g, 7);
  piece(g, 0).position = 1;
  piece(g, 0, 1).position = 10;
  piece(g, 2).position = 3;
  const next = play(
    g,
    0,
    {
      cardIndex: 0,
      moves: [
        { kind: 'move', piece: '0-0', steps: 3 },
        { kind: 'move', piece: '0-1', steps: 4 },
      ],
    },
    random,
  );
  assert.equal(piece(next, 0).position, 4);
  assert.equal(piece(next, 0, 1).position, 14);
  assert.equal(piece(next, 2).position, -1);
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'move', piece: '0-0', steps: 6 }] }, random),
  );
  assert.throws(() =>
    play(
      g,
      0,
      {
        cardIndex: 0,
        moves: [
          { kind: 'move', piece: '0-0', steps: 3 },
          { kind: 'move', piece: '0-0', steps: 4 },
        ],
      },
      random,
    ),
  );
});
test('7 ne mélange pas les couleurs en individuel', () => {
  const g = setup(2);
  card(g, 7);
  piece(g, 0).position = 1;
  piece(g, 1).position = 12;
  assert.throws(() =>
    play(
      g,
      0,
      {
        cardIndex: 0,
        moves: [
          { kind: 'move', piece: '0-0', steps: 3 },
          { kind: 'move', piece: '1-0', steps: 4 },
        ],
      },
      random,
    ),
  );
});
test('défausse autorisée seulement quand aucune carte ne permet de jouer', () => {
  const g = setup();
  card(g, 1);
  assert.throws(() => play(g, 0, { cardIndex: 1, moves: [] }, random));
  card(g, 3);
  const next = play(g, 0, { cardIndex: 0, moves: [] }, random);
  assert.equal(next.discard.at(-1), 3);
});
test("aide au partenaire et victoire de toute l'équipe", () => {
  const g = setup();
  const length = trackLength(g);
  g.pieces
    .filter((p) => p.color === 0)
    .forEach((p, i) => {
      p.position = length + i;
    });
  assert.deepEqual(activeColors(g, 0), [1]);
  g.pieces
    .filter((p) => p.color === 1)
    .forEach((p, i) => {
      p.position = length + i;
    });
  piece(g, 1).position = startPosition(g, 1);
  card(g, 1);
  const next = play(
    g,
    0,
    { cardIndex: 0, moves: [{ kind: 'move', piece: '1-0', steps: 1, home: true }] },
    random,
  );
  assert.equal(next.phase, 'finished');
  assert.equal(next.winner, 0);
});
test("projection privée : ni pioche, ni mains adverses, ni choix d'échange", () => {
  const g = setup();
  const view = viewFor(g, 'p0');
  assert.equal('hands' in view, false);
  assert.equal('deck' in view, false);
  assert.equal('exchanges' in view, false);
  assert.deepEqual(view.hand, g.hands[0]);
  assert.deepEqual(viewFor(g, 'p1').options, []);
  assert.throws(() => viewFor(g, 'outsider'));
  view.hand[0] = 12;
  assert.notEqual(view.hand, g.hands[0]);
});
test('les coups proposés sont exécutables, état et cartes conservés sur 250 tours', () => {
  let seed = 1337;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let g = createGame(
    Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    rng,
  );
  for (let turn = 0; turn < 250 && g.phase !== 'finished'; turn++) {
    if (g.phase === 'exchange')
      for (let actor = 0; actor < g.players.length; actor++) g = exchange(g, actor, 0);
    const options = legalPlays(g, g.turn);
    const action = options[Math.floor(rng() * options.length)] ?? { cardIndex: 0, moves: [] };
    g = play(g, g.turn, action, rng);
    const allCards = [...g.deck, ...g.discard, ...g.hands.flat()];
    assert.equal(allCards.length, 48);
    for (const c of CARDS) assert.equal(allCards.filter((x) => x === c).length, 4);
    for (const p of g.pieces) assert.ok(p.position >= -1 && p.position < trackLength(g) + 4);
    const occupied = g.pieces
      .filter((p) => p.position >= 0)
      .map((p) =>
        p.position < trackLength(g) ? `track:${p.position}` : `${p.color}:${p.position}`,
      );
    assert.equal(new Set(occupied).size, occupied.length);
  }
});
