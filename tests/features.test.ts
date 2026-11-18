import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  canDiscardHand,
  discardHand,
  exchange,
  legalPlays,
  play,
  trackLength,
  viewFor,
  colorOrder,
} from '../src/game/engine';
import { pendingBot, stepBot } from '../src/game/bots';
import { boardLayout } from '../src/game/board-layout';
import { commandSchema } from '../src/server/schema';
import { authErrorMessage, captchaErrorMessage } from '../src/lib/auth-errors';
import { publicConfigurationIssue } from '../src/lib/config';
import { configuredOrigin } from '../src/server/origin';
function setup(count = 4, jokers = false) {
  const g = createGame(
    Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    () => 0.42,
    { jokers },
  );
  g.phase = 'play';
  g.turn = 0;
  return g;
}
test('8 joueurs : 128 cases, 32 pions, 4 équipes opposées et double paquet', () => {
  const g = setup(8, true);
  assert.equal(trackLength(g), 128);
  assert.equal(g.pieces.length, 32);
  const cards = [...g.hands.flat(), ...g.deck];
  assert.equal(cards.length, 98);
  assert.equal(cards.filter((c) => c === 'joker').length, 2);
  for (let i = 0; i < 4; i++) assert.equal(g.players[i].team, g.players[i + 4].team);
  assert.deepEqual(colorOrder(g), [0, 4, 5, 2, 1, 6, 7, 3]);
});
test('49 cartes avec Joker pour 2/3/4/6 ; anciens paquets sans Joker conservés', () => {
  for (const count of [2, 3, 4, 6]) {
    const g = setup(count, true);
    assert.equal(g.hands.flat().length + g.deck.length, 49);
    assert.equal([...g.hands.flat(), ...g.deck].filter((c) => c === 'joker').length, 1);
  }
  assert.equal(setup().hands.flat().length + setup().deck.length, 48);
});
test('Joker démarre, recule, permute ou fractionne 7 ; annonce obligatoire', () => {
  const g = setup(4, true);
  g.hands[0] = ['joker', 2];
  const next = play(
    g,
    0,
    { cardIndex: 0, as: 1, moves: [{ kind: 'start', piece: '0-0' }] },
    () => 0.5,
  );
  assert.equal(next.pieces[0].stake, true);
  assert.equal(next.discard.at(-1), 'joker');
  assert.throws(() =>
    play(g, 0, { cardIndex: 0, moves: [{ kind: 'start', piece: '0-0' }] }, () => 0.5),
  );
  g.pieces[0].position = 8;
  g.pieces[1].position = 20;
  const split = play(
    g,
    0,
    {
      cardIndex: 0,
      as: 7,
      moves: [
        { kind: 'move', piece: '0-0', steps: 3 },
        { kind: 'move', piece: '0-1', steps: 4 },
      ],
    },
    () => 0.5,
  );
  assert.equal(split.pieces[0].position, 11);
  assert.equal(split.pieces[1].position, 24);
  assert.ok(legalPlays(g, 0).some((p) => p.as === -4));
  assert.ok(legalPlays(g, 0).some((p) => p.as === 'swap'));
  assert.throws(() =>
    play(g, 0, { cardIndex: 1, as: 10, moves: [{ kind: 'start', piece: '0-2' }] }, () => 0.5),
  );
});
test('défausse complète : réserve seule, aucune carte de démarrage, bon tour', () => {
  const g = setup();
  g.hands[0] = [2, 3, 7];
  assert.ok(canDiscardHand(g, 0));
  assert.equal(canDiscardHand(g, 1), false);
  const next = discardHand(g, 0, () => 0.5);
  assert.deepEqual(next.hands[0], []);
  assert.equal(next.turn, 1);
  assert.deepEqual(next.discard, [2, 3, 7]);
  assert.equal(g.hands[0].length, 3);
  for (const starter of [1, 10, 'joker'] as const) {
    g.hands[0] = [2, starter];
    assert.equal(canDiscardHand(g, 0), false);
    assert.throws(() => discardHand(g, 0, () => 0.5));
  }
});
test('défausse complète refusée derrière un pieu, même sans coup légal', () => {
  const g = setup();
  g.hands[0] = [2, 3];
  g.pieces[0].position = 10;
  const blocker = g.pieces.find((p) => p.color === 2)!;
  blocker.position = 11;
  blocker.stake = true;
  assert.deepEqual(legalPlays(g, 0), []);
  assert.equal(canDiscardHand(g, 0), false);
  assert.throws(() => discardHand(g, 0, () => 0.5));
  const one = play(g, 0, { cardIndex: 0, moves: [] }, () => 0.5);
  assert.equal(one.hands[0].length, 1);
});
test('défausse complète ne mélange pas réserve et maison ; aide partenaire contrôlée', () => {
  const g = setup();
  g.hands[0] = [2];
  g.pieces[0].position = trackLength(g) + 3;
  assert.equal(canDiscardHand(g, 0), false);
  g.pieces.filter((p) => p.color === 0).forEach((p, i) => (p.position = trackLength(g) + i));
  assert.equal(canDiscardHand(g, 0), true);
});
test('dernière défausse complète redonne et rétablit les échanges', () => {
  let g = setup();
  g.hands[0] = [2, 3];
  for (let i = 1; i < 4; i++) g.hands[i] = [];
  g = discardHand(g, 0, () => 0.5);
  assert.equal(g.phase, 'exchange');
  assert.equal(g.dealer, 1);
  assert.ok(g.hands.every((h) => h.length === 4));
  assert.ok(g.exchanges.every((x) => x === null));
});
test('bots : échanges et coups exécutés par le moteur, sans avancer un humain', () => {
  let g = createGame(
    Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: i > 0 })),
    () => 0.37,
    { jokers: true },
  );
  for (let i = 0; i < 7; i++) g = stepBot(g, () => 0.5);
  assert.equal(pendingBot(g), -1);
  assert.equal(g.phase, 'exchange');
  assert.equal(g.exchanges[0], null);
  assert.deepEqual(
    stepBot(g, () => 0.5),
    g,
  );
  g = exchange(g, 0, 0);
  let steps = 0;
  while (pendingBot(g) >= 0 && steps++ < 20) g = stepBot(g, () => 0.5);
  assert.equal(g.turn, 0);
  assert.equal(g.phase, 'play');
  assert.equal(pendingBot(viewFor(g, 'p0')), -1);
  assert.equal([...g.deck, ...g.discard, ...g.hands.flat()].length, 98);
});
test('plateau physique : cases uniques, panneaux et maisons sans superposition', () => {
  for (const count of [2, 3, 4, 6, 8]) {
    const g = setup(count);
    const b = boardLayout(g);
    assert.equal(b.track.length, trackLength(g));
    const all = [...b.track, ...Object.values(b.homes).flat(), ...Object.values(b.reserves).flat()];
    assert.equal(new Set(all.map((p) => p.join(','))).size, all.length);
    assert.ok(all.every(([x, y]) => x > 0 && x < b.width && y > 0 && y < b.height));
    assert.equal(b.seams.length, colorOrder(g).length / 2 - 1);
    assert.deepEqual(b.track[0], [112, 240]);
    assert.deepEqual(b.homes[0], [
      [152, 240],
      [152, 200],
      [152, 160],
      [152, 120],
    ]);
  }
});
test('commandes : chat borné, bots sans coup arbitraire, Joker annoncé', () => {
  const code = 'AABBCCDDEEFF';
  assert.ok(
    commandSchema.safeParse({ type: 'create', name: 'Alix', capacity: 8, jokers: true }).success,
  );
  assert.ok(
    commandSchema.safeParse({
      type: 'chat',
      code,
      id: '6e317781-93ec-4caa-b9de-9681fa30ae31',
      text: 'Bonjour',
    }).success,
  );
  for (const text of ['', ' '.repeat(5), 'a'.repeat(501), 'test\u0000'])
    assert.equal(
      commandSchema.safeParse({
        type: 'chat',
        code,
        id: '6e317781-93ec-4caa-b9de-9681fa30ae31',
        text,
      }).success,
      false,
    );
  assert.equal(
    commandSchema.safeParse({ type: 'bot-tick', code, version: 0, actor: 1 }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: 'play',
      code,
      version: 0,
      play: { cardIndex: 0, as: 13, moves: [] },
    }).success,
    false,
  );
});
test('diagnostics : URL dashboard refusée, origine normalisée sans ouvrir les accès', () => {
  assert.ok(publicConfigurationIssue('https://supabase.com/dashboard/project/test', 'key'));
  assert.equal(publicConfigurationIssue('https://example.supabase.co', 'key'), null);
  assert.equal(
    configuredOrigin(' https://tactik-bigflom.vercel.app/ '),
    'https://tactik-bigflom.vercel.app',
  );
  assert.equal(configuredOrigin('https://tactik-bigflom.vercel.app/evil'), null);
  assert.match(authErrorMessage('captcha_failed'), /CAPTCHA/);
  assert.match(authErrorMessage('signup_disabled'), /désactivée/);
  assert.match(captchaErrorMessage('110200'), /domaine/);
});

test('réserves : leurs panneaux ne recouvrent aucune case du parcours', () => {
  for (const count of [4, 6, 8]) {
    const layout = boardLayout(setup(count));
    for (const reserve of Object.values(layout.reserves)) {
      const horizontal = reserve[0][1] === reserve[1][1];
      const left = Math.min(...reserve.map(([x]) => x)) - 20.5;
      const top = Math.min(...reserve.map(([, y]) => y)) - 21.5;
      for (const [x, y] of layout.track) {
        const dx = Math.max(left - x, 0, x - (left + (horizontal ? 101 : 41)));
        const dy = Math.max(top - y, 0, y - (top + (horizontal ? 43 : 103)));
        assert.ok(Math.hypot(dx, dy) > 16, `Parcours masqué à ${count} : ${x},${y}`);
      }
    }
  }
});
