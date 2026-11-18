import type { Card, Move } from './types';
export const COLOR_NAMES = ['Rouge', 'Jaune', 'Bleu', 'Vert', 'Noir', 'Blanc', 'Violet', 'Orange'];
export const cardTitle = (c: Card) =>
  c === 'joker'
    ? 'Joker'
    : c === 'swap'
      ? 'Permuter'
      : c === 7
        ? 'Répartir 7'
        : c === -4
          ? 'Reculer'
          : c === 1 || c === 10
            ? 'Avancer / démarrer'
            : 'Avancer';
export const cardSymbol = (c: Card) =>
  c === 'joker' ? '★' : c === 'swap' ? '⇄' : c === 7 ? '7×1' : String(c);
export const moveLabel = (m: Move) =>
  `${COLOR_NAMES[Number(m.piece[0])]} ${Number(m.piece[2]) + 1} : ${m.kind === 'start' ? 'démarrer' : m.kind === 'swap' ? `permuter avec ${COLOR_NAMES[Number(m.target[0])]} ${Number(m.target[2]) + 1}` : `${m.steps < 0 ? 'reculer' : 'avancer'} de ${Math.abs(m.steps)}${m.home ? ' vers la maison' : ''}`}`;
