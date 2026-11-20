'use client';
import { useEffect, useId, useRef } from 'react';
import { colorOrder, startPosition, trackLength } from '@/game/engine';
import { boardLayout, boardOrientation } from '@/game/board-layout';
import { moveDestination } from '@/game/move-preview';
import { moveLabel } from '@/game/labels';
import type { View, Move, PieceChange } from '@/game/types';
import { cardSymbol, COLOR_NAMES } from '@/game/labels';
export { COLOR_NAMES } from '@/game/labels';
export const PALETTE = [
  '#c7372d',
  '#e9bd20',
  '#205eb3',
  '#16805b',
  '#292b2c',
  '#f2eee1',
  '#8d4baf',
  '#e98028',
];
export function Board({
  game,
  selected,
  playable,
  onPiece,
  destinations = [],
  onMove,
  orient = false,
  historyChanges = [],
}: {
  game: View;
  historyChanges?: PieceChange[];
  orient?: boolean;
  destinations?: Move[];
  onMove?: (move: Move) => void;
  selected?: string;
  playable: string[];
  onPiece: (id: string) => void;
}) {
  const uid = useId();
  const svg = useRef<SVGSVGElement>(null);
  const lastTurn = useRef(game.history?.[0]?.id);
  const turn = game.history?.[0];
  useEffect(() => {
    const previous = lastTurn.current;
    lastTurn.current = turn?.id;
    if (
      !turn ||
      turn.id === previous ||
      (previous !== undefined && turn.id !== previous + 1) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const animations: Animation[] = [];
    const card = turn.as ?? turn.card;
    const stepDurations = new Map<number, number>();
    const paths = turn.changes.map((change) => {
      const positions = [change.from];
      if (change.captured || change.from < 0 || card === 'swap') positions.push(change.to);
      else {
        let position = change.from;
        for (let i = 0; i < 12 && position !== change.to; i++) {
          position =
            position >= length
              ? position + 1
              : change.to >= length && position === startPosition(game, change.color)
                ? length
                : (position + (card === -4 ? -1 : 1) + length) % length;
          positions.push(position);
        }
        if (positions.at(-1) !== change.to) positions.splice(1, positions.length, change.to);
      }
      const duration = Math.max(600, (positions.length - 1) * 180);
      stepDurations.set(change.step, Math.max(stepDurations.get(change.step) ?? 0, duration));
      return { change, positions, duration };
    });
    const total = [...stepDurations.values()].reduce((sum, duration) => sum + duration, 0);
    const pieceFrames = new Map<string, Keyframe[]>();
    for (const { change, positions, duration } of paths) {
      const delay = [...stepDurations]
        .filter(([step]) => step < change.step)
        .reduce((sum, [, ms]) => sum + ms, 0);
      const frames = pieceFrames.get(change.piece) ?? [];
      positions.forEach((position, index) => {
        const [x, y] =
          position < 0
            ? layout.reserves[change.color][Number(change.piece.split('-')[1])]
            : position >= length
              ? layout.homes[change.color][position - length]
              : layout.track[position];
        const transform = `translate(${x}px, ${y}px)`;
        if (!frames.length) frames.push({ transform, offset: 0 });
        frames.push({
          transform,
          offset: (delay + (duration * index) / (positions.length - 1)) / total,
        });
      });
      pieceFrames.set(change.piece, frames);
    }
    for (const [piece, frames] of pieceFrames) {
      const element = svg.current?.querySelector(`[data-piece="${piece}"]`);
      frames.push({ ...frames.at(-1), offset: 1 });
      if (element) animations.push(element.animate(frames, { duration: total, easing: 'linear' }));
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [turn?.id]);
  const layout = boardLayout(game),
    length = trackLength(game),
    order = colorOrder(game);
  const legalMoves = new Set(game.options.flatMap((p) => p.moves.map((m) => JSON.stringify(m))));
  const currentDestinations = destinations.filter((m) => legalMoves.has(JSON.stringify(m)));
  const orientation = orient
    ? boardOrientation(game, game.players[game.me].colors[0])
    : { angle: 0, width: layout.width, height: layout.height };
  return (
    <svg
      ref={svg}
      className="board"
      viewBox={`0 0 ${orientation.width} ${orientation.height}`}
      role="group"
      aria-label={`Plateau TAC-TIK ${order.length} couleurs, ${length} cases`}
    >
      <g
        transform={`translate(${orientation.width / 2} ${orientation.height / 2}) rotate(${orientation.angle}) translate(${-layout.width / 2} ${-layout.height / 2})`}
      >
        <defs>
          <marker
            id={`${uid}-arrow`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M0 0L7 3.5L0 7Z" fill="#145b91" />
          </marker>
          <linearGradient id={`${uid}-timber`} x2=".8" y2="1">
            <stop stopColor="#e4c795" />
            <stop offset=".45" stopColor="#f2dbb1" />
            <stop offset="1" stopColor="#d9b982" />
          </linearGradient>
          <pattern id={`${uid}-grain`} width="79" height="200" patternUnits="userSpaceOnUse">
            <path
              d="M3 -20 Q18 50 5 130 T8 220 M21 -20 Q9 70 25 170 T23 240 M43 -20 Q57 90 41 180 T44 220 M65 -20 Q53 50 69 140 T67 220"
              fill="none"
              stroke="#8c6536"
              strokeOpacity=".12"
            />
            <path d="M12 20v25m20 46v50m18-100v27m22 62v42" stroke="#866236" strokeOpacity=".2" />
          </pattern>
          <radialGradient id={`${uid}-hole`}>
            <stop stopColor="#57402b" />
            <stop offset=".7" stopColor="#88653f" />
            <stop offset="1" stopColor="#af8a58" />
          </radialGradient>
          <filter id={`${uid}-peg-shadow`}>
            <feDropShadow dx="1" dy="3" stdDeviation="1.5" floodOpacity=".25" />
          </filter>
        </defs>
        <rect
          x="3"
          y="3"
          width={layout.width - 6}
          height="594"
          rx="4"
          fill={`url(#${uid}-timber)`}
          stroke="#b38f5e"
          strokeWidth="3"
        />
        <rect
          x="3"
          y="3"
          width={layout.width - 6}
          height="594"
          rx="4"
          fill={`url(#${uid}-grain)`}
        />
        {layout.seams.map((x) => (
          <path key={x} d={`M${x} 4V596`} stroke="#715536" strokeOpacity=".25" strokeWidth="2" />
        ))}
        {layout.track.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="10"
              fill={`url(#${uid}-hole)`}
              stroke="#f6e4c7"
              strokeWidth="1.4"
            />
            {i % 4 === 0 && (
              <circle
                cx={x}
                cy={y}
                r="14.5"
                fill="none"
                stroke={i % 16 === 0 ? PALETTE[order[i / 16]] : '#382e22'}
                strokeWidth={i % 16 === 0 ? 4 : 2}
              />
            )}
          </g>
        ))}
        {order.map((c) => {
          const home = layout.homes[c],
            reserve = layout.reserves[c];
          const minX = Math.min(...reserve.map((p) => p[0])),
            minY = Math.min(...reserve.map((p) => p[1]));
          const maxX = Math.max(...reserve.map((p) => p[0])),
            maxY = Math.max(...reserve.map((p) => p[1]));
          const paddingX = maxX - minX === 57 ? 12.5 : 18;
          return (
            <g key={c}>
              <path
                d={`M${home.map((p) => p.join(',')).join(' L')}`}
                stroke={PALETTE[c]}
                strokeWidth="27"
                strokeLinecap="round"
                fill="none"
              />
              {home.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="9.5"
                  fill={`url(#${uid}-hole)`}
                  stroke="#f5dcac"
                  strokeWidth="1"
                />
              ))}
              <rect
                x={minX - paddingX}
                y={minY - 19}
                width={maxX - minX + paddingX * 2}
                height={maxY - minY + 38}
                rx="12"
                fill="#342e24"
                stroke={PALETTE[c]}
                strokeWidth="5"
              />
            </g>
          );
        })}
        <g transform={`rotate(${-orientation.angle} ${layout.width / 2} ${layout.height / 2})`}>
          <text
            x={layout.width / 2}
            y="240"
            textAnchor="middle"
            fontFamily="Georgia,serif"
            fontSize="26"
            fill="#493a25"
            letterSpacing="3"
          >
            TAC✳TIK
          </text>
          <g transform={`translate(${layout.width / 2 - 68},260)`}>
            <rect width="60" height="90" rx="6" fill="#263e34" stroke="#f0e4c8" strokeWidth="3" />
            <text x="30" y="54" textAnchor="middle" fill="#e6d5ad" fontSize="28">
              ✳
            </text>
          </g>
          <g transform={`translate(${layout.width / 2 + 8},260)`}>
            <rect width="60" height="90" rx="6" fill="#fbf4e6" stroke="#a48d65" />
            <text
              x="30"
              y="54"
              textAnchor="middle"
              fill="#493b29"
              fontFamily="Georgia,serif"
              fontSize="30"
            >
              {game.discard.length ? cardSymbol(game.discard.at(-1)!) : ''}
            </text>
          </g>
        </g>
        {currentDestinations.map((move) => {
          const { color, position } = moveDestination(game, move);
          const point =
            position >= length ? layout.homes[color]?.[position - length] : layout.track[position];
          if (!point) return null;
          const [x, y] = point;
          return (
            <g
              key={JSON.stringify(move)}
              role="button"
              tabIndex={onMove ? 0 : -1}
              aria-label={`Destination : ${moveLabel(move)}`}
              className="destination"
              onClick={() => onMove?.(move)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onMove?.(move);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="16"
                fill="#ffffff99"
                stroke="#155b86"
                strokeWidth="3"
                strokeDasharray="4 2"
              />
              <circle cx={x} cy={y} r="5" fill={PALETTE[color]} stroke="#243b32" />
            </g>
          );
        })}
        {game.pieces.map((p) => {
          const n = Number(p.id.split('-')[1]);
          const [x, y] =
            p.position < 0
              ? layout.reserves[p.color][n]
              : p.position >= length
                ? layout.homes[p.color][p.position - length]
                : layout.track[p.position];
          const landing = currentDestinations.find((move) => {
            const target = moveDestination(game, move);
            return (
              p.position >= 0 &&
              target.position === p.position &&
              (p.position < length || target.color === p.color)
            );
          });
          const enabled = playable.includes(p.id) || Boolean(landing && onMove);
          const choose = () => {
            if (playable.includes(p.id)) onPiece(p.id);
            else if (landing) onMove?.(landing);
          };
          return (
            <g
              key={p.id}
              data-piece={p.id}
              role="button"
              tabIndex={enabled ? 0 : -1}
              aria-disabled={!enabled}
              aria-label={`${COLOR_NAMES[p.color]} ${n + 1}, ${p.position < 0 ? 'réserve' : p.position >= length ? 'maison' : p.stake ? 'pieu' : 'parcours'}`}
              onClick={() => enabled && choose()}
              onKeyDown={(e) => {
                if (enabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  choose();
                }
              }}
              className={enabled ? 'peg selectable' : 'peg'}
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              {(enabled || selected === p.id) && (
                <circle
                  cx={0}
                  cy={0}
                  r="19"
                  fill="#fff9"
                  stroke="#184a77"
                  strokeWidth="2"
                  strokeDasharray={selected === p.id ? undefined : '3 3'}
                />
              )}
              <g pointerEvents="none" transform={`rotate(${-orientation.angle})`}>
                <path d="M-7 -14 L0 -9 L7 -14" fill="#fff" stroke="#263c32" />
                <rect x="-10" y="-32" width="20" height="19" rx="7" fill="#fff" stroke="#263c32" />
                <text
                  x="0"
                  y="-18"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="bold"
                  fill="#263c32"
                >
                  {n + 1}
                </text>
              </g>
              <g filter={`url(#${uid}-peg-shadow)`}>
                <circle r="8.5" fill={PALETTE[p.color]} stroke="#26251e" strokeWidth="1.2" />
                <circle cx="-2" cy="-2" r="4" fill="#fff" opacity=".23" />
                {p.stake && <circle r="3" fill="#191919" stroke="#fff" strokeWidth="1" />}
              </g>
            </g>
          );
        })}
        <g pointerEvents="none" aria-label="Aperçu du coup : départ en pointillés, arrivée pleine">
          {historyChanges.map((change, i) => {
            const point = (position: number) =>
              position < 0
                ? layout.reserves[change.color]?.[Number(change.piece.split('-')[1])]
                : position >= length
                  ? layout.homes[change.color]?.[position - length]
                  : layout.track[position];
            const from = point(change.from),
              to = point(change.to);
            if (!from || !to) return null;
            return (
              <g key={i}>
                <path
                  d={`M${from.join(',')} L${to.join(',')}`}
                  fill="none"
                  stroke={change.captured ? '#b43d26' : '#145b91'}
                  strokeWidth="4"
                  strokeDasharray={change.captured ? '6 4' : undefined}
                  markerEnd={`url(#${uid}-arrow)`}
                />
                <circle
                  cx={from[0]}
                  cy={from[1]}
                  r="17"
                  fill="#fff9"
                  stroke="#b86616"
                  strokeWidth="4"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={to[0]}
                  cy={to[1]}
                  r="13"
                  fill={PALETTE[change.color]}
                  stroke={change.captured ? '#b43d26' : '#145b91'}
                  strokeWidth="4"
                />
                <text
                  x={to[0]}
                  y={to[1] + 4}
                  textAnchor="middle"
                  fill={change.color === 1 || change.color === 5 ? '#111' : '#fff'}
                  fontSize="12"
                  fontWeight="bold"
                  transform={`rotate(${-orientation.angle} ${to[0]} ${to[1]})`}
                >
                  {change.step + 1}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
