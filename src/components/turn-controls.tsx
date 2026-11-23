'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { CARDS, type BaseCard, type Move, type Play, type View } from '@/game/types';
import { cardSymbol, cardTitle, moveLabel, COLOR_NAMES } from '@/game/labels';
import { swapChoices } from '@/game/move-preview';
import { PALETTE } from './board';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function TurnControls({
  view,
  busy,
  selectedPiece,
  onPiece,
  onPlayable,
  onDestinations,
  onPreview,
  interaction,
  onExchange,
  onPlay,
  onDiscardHand,
}: {
  view: View;
  busy: boolean;
  selectedPiece?: string;
  onPiece: (id: string | undefined) => void;
  onPlayable: (ids: string[]) => void;
  onDestinations: (moves: Move[]) => void;
  onPreview: (action: Play | null) => void;
  interaction: RefObject<{ piece: (id: string) => void; move: (move: Move) => void }>;
  onExchange: (index: number) => void;
  onPlay: (action: Play) => void;
  onDiscardHand: () => void;
}) {
  const [card, setCard] = useState<number | null>(null),
    [as, setAs] = useState<BaseCard | undefined>(),
    [draft, setDraft] = useState<Move[]>([]);
  // Chat and other players' exchange confirmations must not erase the local choice.
  const revision = JSON.stringify([
    view.phase,
    view.turn,
    view.hand,
    view.pieces,
    view.exchanged[view.me],
  ]);
  useEffect(() => {
    setCard(view.hand.length === 1 ? 0 : null);
    setDraft([]);
    setAs(undefined);
    onPiece(undefined);
  }, [revision, onPiece]);
  const isTurn = view.phase === 'play' && view.turn === view.me,
    exchanging = view.phase === 'exchange' && !view.exchanged[view.me];
  const actions =
    card === null
      ? []
      : view.options.filter(
          (p) => p.cardIndex === card && p.as === as && draft.every((m, i) => same(m, p.moves[i])),
        );
  const next = [
    ...new Map(
      actions
        .filter((p) => p.moves.length > draft.length)
        .map((p) => {
          const m = p.moves[draft.length];
          return [JSON.stringify(m), m];
        }),
    ).values(),
  ];
  const ids = [...new Set(next.map((m) => m.piece))];
  const swaps = next.filter((move) => move.kind === 'swap');
  const swapping = swaps.length > 0;
  const swap = swapChoices(swaps, selectedPiece);
  const playableIds = swapping ? swap.ids : ids;
  const idsKey = playableIds.join(',');
  useEffect(() => {
    onPlayable(playableIds);
  }, [idsKey, onPlayable]);
  const complete = draft.length > 0 && actions.some((p) => p.moves.length === draft.length),
    discard = isTurn && !view.options.length;
  const autoRevision = useRef(revision);
  const autoKey = JSON.stringify([revision, card, as, draft, ids]);
  useEffect(() => {
    if (autoRevision.current !== revision) {
      autoRevision.current = revision;
      return;
    }
    if (!isTurn || busy || complete || swapping || ids.length !== 1) return;
    const choices = next.filter((m) => m.piece === ids[0]);
    onPiece(ids[0]);
    if (choices.length === 1 && choices[0].kind !== 'swap') setDraft([...draft, choices[0]]);
  }, [autoKey, busy]);
  const previewKey = JSON.stringify(complete ? { cardIndex: card, moves: draft, as } : null);
  useEffect(() => {
    onPreview(complete && card !== null ? { cardIndex: card, moves: draft, as } : null);
  }, [previewKey, onPreview]);
  const shownMoves = complete
    ? draft
    : swapping
      ? []
      : next.filter((m) => !selectedPiece || m.piece === selectedPiece);
  const shownKey = JSON.stringify(shownMoves);
  useEffect(() => {
    onDestinations(shownMoves);
  }, [shownKey, onDestinations]);
  function addMove(move: Move) {
    if (busy || !next.some((m) => same(m, move))) return;
    setDraft([...draft, move]);
    onPiece(undefined);
  }
  function selectPiece(id: string) {
    if (busy) return;
    if (swapping) {
      const move = swap.pairs.find((pair) => pair.id === id)?.move;
      if (move) addMove(move);
      else if (swap.ids.includes(id)) onPiece(id === selectedPiece ? undefined : id);
      return;
    }
    const choices = next.filter((m) => m.piece === id);
    if (
      choices.length === 1 &&
      choices[0].kind !== 'swap' &&
      view.hand[card ?? -1] !== 7 &&
      as !== 7
    )
      addMove(choices[0]);
    else onPiece(id);
  }
  useEffect(() => {
    interaction.current = { piece: selectPiece, move: addMove };
  });
  function choose(index: number) {
    setCard(index);
    setDraft([]);
    setAs(undefined);
    onPiece(undefined);
  }
  const status =
    view.phase === 'finished'
      ? `Victoire : ${view.players
          .filter((p) => p.team === view.winner)
          .map((p) => p.name)
          .join(' + ')}`
      : exchanging
        ? 'Sélectionner une carte à échanger'
        : view.phase === 'exchange'
          ? 'Échange confirmé'
          : !isTurn
            ? `Tour de ${view.players[view.turn].name}`
            : discard
              ? 'Aucun déplacement possible'
              : card === null
                ? 'Sélectionner une carte'
                : view.hand[card] === 'joker' && as === undefined
                  ? 'Choisir la valeur du Joker'
                  : complete
                    ? 'Coup prêt'
                    : swapping
                      ? !selectedPiece
                        ? 'Choisir le premier pion à permuter'
                        : ids.includes(selectedPiece)
                          ? 'Choisir le pion à échanger avec lui'
                          : 'Choisir votre pion à permuter'
                      : selectedPiece
                        ? 'Sélectionner un déplacement'
                        : 'Sélectionner un pion';
  return (
    <section className="turn-controls" aria-label="Cartes et actions">
      <div className="turn-status" role="status">
        <span className={isTurn || exchanging ? 'turn-indicator active' : 'turn-indicator'} />
        <b>{status}</b>
        <span>{view.hand.length} cartes</span>
      </div>
      <div className="hand">
        {view.hand.map((c, i) => (
          <button
            key={`${i}-${c}`}
            className={`playing-card ${card === i ? 'chosen' : ''} ${c === 'joker' ? 'joker' : ''}`}
            disabled={busy || (!isTurn && !exchanging)}
            aria-pressed={card === i}
            aria-label={`Carte ${cardSymbol(c)}, ${cardTitle(c)}`}
            onClick={() => choose(i)}
          >
            <strong>{cardSymbol(c)}</strong>
            <span>{cardTitle(c)}</span>
          </button>
        ))}
      </div>
      {card !== null && view.hand[card] === 'joker' && isTurn && (
        <div className="joker-options" aria-label="Valeur du Joker">
          {CARDS.map((c) => (
            <button
              key={c}
              disabled={busy}
              aria-pressed={as === c}
              className={as === c ? 'selected' : ''}
              onClick={() => {
                setAs(c);
                setDraft([]);
                onPiece(undefined);
              }}
            >
              {cardSymbol(c)}
            </button>
          ))}
        </div>
      )}
      <div className="move-editor">
        {draft.length > 0 && (
          <div className="draft">
            <ol>
              {draft.map((m, i) => (
                <li key={i}>{moveLabel(m)}</li>
              ))}
            </ol>
            <button
              onClick={() => {
                setCard(null);
                setAs(undefined);
                setDraft([]);
                onPiece(undefined);
              }}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        )}
        {card !== null && (view.hand[card] === 7 || as === 7) && isTurn && (
          <small>{draft.reduce((n, m) => n + (m.kind === 'move' ? m.steps : 0), 0)} / 7 pas</small>
        )}
        {!complete && ids.length > 0 && (
          <div className="piece-choices" aria-label="Pions jouables">
            {playableIds.map((id) => (
              <button
                key={id}
                disabled={busy}
                aria-pressed={selectedPiece === id}
                onClick={() => selectPiece(id)}
              >
                <i style={{ background: PALETTE[Number(id[0])] }} />
                {COLOR_NAMES[Number(id[0])]} {Number(id[2]) + 1}
              </button>
            ))}
          </div>
        )}
        {selectedPiece && !swapping && !complete && (
          <div className="move-options">
            {next
              .filter((m) => m.piece === selectedPiece)
              .map((m) => (
                <button
                  key={JSON.stringify(m)}
                  disabled={busy}
                  onClick={() => {
                    addMove(m);
                  }}
                >
                  {moveLabel(m)}
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="turn-buttons">
        {view.canDiscardHand && (
          <button className="secondary" disabled={busy} onClick={onDiscardHand}>
            Défausser toute la main
          </button>
        )}
        {view.phase !== 'finished' && (
          <button
            className="primary"
            disabled={busy || card === null || (!exchanging && !(isTurn && (complete || discard)))}
            onClick={() => {
              if (card === null) return;
              if (exchanging) onExchange(card);
              else onPlay({ cardIndex: card, moves: draft, ...(as === undefined ? {} : { as }) });
            }}
          >
            {busy
              ? 'Envoi...'
              : exchanging
                ? 'Échanger'
                : discard
                  ? 'Défausser la carte'
                  : 'Valider le coup'}
          </button>
        )}
      </div>
    </section>
  );
}
