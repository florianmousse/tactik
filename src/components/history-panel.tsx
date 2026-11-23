'use client';
import { useEffect, useRef, useState } from 'react';
import type { View } from '@/game/types';
import { cardSymbol, COLOR_NAMES } from '@/game/labels';
import { trackLength } from '@/game/engine';
import { Board } from './board';

export function HistoryPanel({ view, onClose }: { onClose: () => void; view: View }) {
  const [selectedId, setSelectedId] = useState(view.history?.[0]?.id);
  const records = view.history ?? [];
  const index = Math.max(
    0,
    records.findIndex((record) => record.id === selectedId),
  );
  const selected = records[index];
  const positions = new Map<string, number>();
  for (const newer of records.slice(0, index)) {
    for (const change of [...newer.changes].reverse()) positions.set(change.piece, change.from);
  }
  const replay = {
    ...view,
    history: [],
    discard: selected?.card ? [selected.card] : [],
    pieces: view.pieces.map((piece) =>
      positions.has(piece.id)
        ? { ...piece, position: positions.get(piece.id)!, stake: false }
        : piece,
    ),
  };
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
          onMouseEnter={() => setSelectedId(record.id)}
          onFocus={() => setSelectedId(record.id)}
          onClick={() => setSelectedId(record.id)}
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
    <dialog ref={dialog} className="history-dialog" aria-label="Revoir les coups" onClose={onClose}>
      <header>
        <h2>Revoir les coups</h2>
        <button autoFocus onClick={() => dialog.current?.close()}>
          Fermer
        </button>
      </header>
      <div className="history-replay">
        <Board
          game={replay}
          orient
          showSeats={false}
          playable={[]}
          destinations={[]}
          onPiece={() => {}}
          historyChanges={selected?.changes ?? []}
        />
      </div>
      <div className="history-scroll">
        <p>Choisissez un coup. Le départ est en pointillés, l'arrivée en trait plein.</p>
        {entries()}
        <details>
          <summary>Journal de la partie</summary>
          <p className="muted">
            Messages textuels : distributions, échanges, coups et victoire. Les coups détaillés
            au-dessus permettent de revoir les positions sur le plateau.
          </p>
          {view.log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </details>
      </div>
    </dialog>
  );
}
