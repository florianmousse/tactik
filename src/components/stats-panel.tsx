import { useEffect, useRef, useState } from 'react';
import { statsFor, type PlayerStats } from '@/game/stats';
import type { View } from '@/game/types';

const metrics = {
  distance: [
    'Cases parcourues',
    'Les pas en avant et en arrière sont additionnés, y compris avec un 7 partagé.',
  ],
  captures: [
    'Captures',
    'Chaque pion renvoyé en réserve compte pour le joueur qui a joué, y compris un pion allié.',
  ],
  losses: ['Captures subies', 'Chaque pion renvoyé en réserve compte pour son propriétaire.'],
  starts: ['Sorties de réserve', 'Chaque démarrage avec un 1, un 10 ou un Joker compte une fois.'],
  plays: [
    'Cartes jouées',
    'Une carte compte pour un coup joué. Les échanges et les défausses sont exclus.',
  ],
};

export function StatsPanel({ view, onClose }: { view: View; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [metric, setMetric] = useState<keyof PlayerStats>('distance');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const stats = statsFor(view);
  const ranking = view.players
    .map((player, seat) => ({ player, seat, value: stats.players[seat][metric] }))
    .sort((a, b) => b.value - a.value);
  return (
    <dialog ref={dialog} onClose={onClose} className="stats-dialog" aria-labelledby="stats-title">
      <header>
        <h2 id="stats-title">Statistiques de la partie</h2>
        <button autoFocus onClick={() => dialog.current?.close()}>
          Fermer
        </button>
      </header>
      <label>
        Classement par{' '}
        <select value={metric} onChange={(e) => setMetric(e.target.value as keyof PlayerStats)}>
          {Object.entries(metrics).map(([key, [label]]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p>{metrics[metric][1]}</p>
      <table>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Joueur</th>
            <th>{metrics[metric][0]}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map(({ player, seat, value }) => (
            <tr key={player.id}>
              <td>{ranking.findIndex((row) => row.value === value) + 1}</td>
              <th scope="row">
                {player.name}
                {seat === view.me ? ' (vous)' : ''}
              </th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.partial && (
        <p>
          Ancienne partie : seuls les coups encore en mémoire lors de la mise à jour et les coups
          suivants sont comptés.
        </p>
      )}
    </dialog>
  );
}
