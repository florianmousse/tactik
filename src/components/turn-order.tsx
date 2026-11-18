import { turnOrder } from '@/game/turn-order';
import type { View } from '@/game/types';
import { PALETTE } from './board';
export function TurnOrder({ view }: { view: View }) {
  if (view.phase === 'finished') return null;
  const order = turnOrder(view);
  const name = (seat: number) => (
    <b>
      <i style={{ background: PALETTE[view.players[seat].colors[0]] }} />
      {view.players[seat].name}
      {seat === view.me ? ' (vous)' : ''}
    </b>
  );
  return (
    <div className="turn-order" aria-label="Ordre de jeu">
      <span>
        {view.phase === 'exchange' ? "Commence après l'échange : " : 'À suivre : '}
        {order.next === null ? 'Nouvelle donne' : name(order.next)}
      </span>
      <span>Première personne à la prochaine donne : {name(order.nextDeal)}</span>
    </div>
  );
}
