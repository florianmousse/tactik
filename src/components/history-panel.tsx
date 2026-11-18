'use client';
import { useEffect, useRef, useState } from 'react';
import type { TurnRecord, View } from '@/game/types';
import { cardSymbol, COLOR_NAMES } from '@/game/labels';
import { trackLength } from '@/game/engine';
import { Board } from './board';

export function HistoryPanel({
  view,
  selected,
  onSelect,
}: {
  view: View;
  selected: TurnRecord | null;
  onSelect: (record: TurnRecord | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const position = (n: number) =>
    n < 0
      ? 'réserve'
      : n >= trackLength(view)
        ? `maison ${n - trackLength(view) + 1}`
        : `case ${n + 1}`;
  const entries = () => (
    <div className="history-list" aria-label="Coups joués">
      {(view.history ?? []).map((record) => (
        <button
          key={record.id}
          className={selected?.id === record.id ? 'selected' : ''}
          onMouseEnter={() => onSelect(record)}
          onFocus={() => onSelect(record)}
          onClick={() => onSelect(record)}
          aria-pressed={selected?.id === record.id}
        >
          <b>
            {view.players[record.actor]?.name ?? 'Joueur'} -{' '}
            {record.kind === 'discard-hand'
              ? 'défausse sa main'
              : `${record.kind === 'discard' ? 'défausse' : 'joue'} ${record.card === null ? '' : cardSymbol(record.card)}${record.as === undefined ? '' : ` (${cardSymbol(record.as)})`}`}
          </b>
          <small>
            Donne {record.round} · Coup {record.id}
          </small>
          {record.changes.map((c, i) => (
            <span key={i}>
              {c.step + 1}. {COLOR_NAMES[c.color]} {Number(c.piece.split('-')[1]) + 1} :{' '}
              {position(c.from)} → {position(c.to)}
              {c.captured ? ' (capturé)' : ''}
            </span>
          ))}
        </button>
      ))}
      {!view.history?.length && (
        <p>
          Les prochains coups pourront être revus ici. Les anciens coups ne contiennent pas leurs
          positions.
        </p>
      )}
    </div>
  );
  return (
    <section className="history-panel" aria-label="Historique des coups">
      <div className="history-tools">
        <button onClick={() => setExpanded(true)}>Agrandir l'historique</button>
        <button disabled={!selected} onClick={() => onSelect(null)}>
          Effacer l'aperçu
        </button>
      </div>
      <p className="muted">
        Survolez, sélectionnez au clavier ou touchez un coup. Pointillés orange : départ. Cercle
        plein : arrivée. Trait rouge : capture.
      </p>
      {entries()}
      <details>
        <summary>Événements de la partie</summary>
        {view.log.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </details>
      <dialog ref={dialog} className="history-dialog" onClose={() => setExpanded(false)}>
        <header>
          <h2>Revoir les coups</h2>
          <button autoFocus onClick={() => setExpanded(false)}>
            Fermer
          </button>
        </header>
        <div className="history-replay">
          <Board
            game={view}
            orient
            playable={[]}
            destinations={[]}
            onPiece={() => {}}
            historyChanges={selected?.changes ?? []}
          />
        </div>
        <p>Départ en pointillés orange, arrivée pleine. Touchez un coup pour le revoir.</p>
        {entries()}
      </dialog>
    </section>
  );
}
