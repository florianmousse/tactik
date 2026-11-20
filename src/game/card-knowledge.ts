import { CARDS, type Card, type CardKnowledge, type Game, type View } from './types';
export const emptyKnowledge = (): CardKnowledge => ({ spent: {}, known: [] });
// Only call on a cloned transition state. Old saves start with no invented knowledge.
export function memoriesFor(game: Game): CardKnowledge[] {
  return (game.memories ??= game.players.map(emptyKnowledge));
}
export function observeCards(game: Game, actor: number, cards: Card[], publicCards: boolean) {
  memoriesFor(game).forEach((memory, observer) => {
    if (publicCards || observer === actor)
      for (const card of cards) memory.spent[card] = (memory.spent[card] ?? 0) + 1;
    if (!publicCards) memory.known = memory.known.filter((item) => item.player !== actor);
    else
      for (const card of cards) {
        const index = memory.known.findIndex((item) => item.player === actor && item.card === card);
        // An identical copy may remain, but it is no longer certain.
        if (index >= 0) memory.known.splice(index, 1);
      }
  });
}
// Approximation over unseen cards, including the draw pile and unseen discarded hands.
// This never reads view.discard, which may include cards discarded face down as a whole hand.
export function cardChance(view: View, actor: number, useful: Card[]): number {
  if (!useful.length || !view.handCounts[actor]) return 0;
  if (actor === view.me) return Number(view.hand.some((card) => useful.includes(card)));
  const memory = view.knowledge ?? emptyKnowledge();
  const known = memory.known.filter((item) => view.handCounts[item.player] > 0);
  const held = known.filter((item) => item.player === actor);
  if (held.some((item) => useful.includes(item.card))) return 1;
  const packs = view.players.length === 8 ? 2 : 1;
  const cards: Card[] = [...CARDS, ...(view.jokers ? ['joker' as const] : [])];
  let total = 0,
    matches = 0;
  for (const card of cards) {
    const count = Math.max(
      0,
      packs * (card === 'joker' ? 1 : 4) -
        (memory.spent[card] ?? 0) -
        view.hand.filter((c) => c === card).length -
        known.filter((item) => item.card === card).length,
    );
    total += count;
    if (useful.includes(card)) matches += count;
  }
  const slots = Math.min(total, Math.max(0, view.handCounts[actor] - held.length));
  let miss = 1;
  for (let i = 0; i < slots; i++) miss *= Math.max(0, total - matches - i) / (total - i);
  return 1 - miss;
}
