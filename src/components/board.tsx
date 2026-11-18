'use client';
import { colorOrder, trackLength } from '@/game/engine';
import { boardLayout } from '@/game/board-layout';
import type { View } from '@/game/types';
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
}: {
  game: View;
  selected?: string;
  playable: string[];
  onPiece: (id: string) => void;
}) {
  const layout = boardLayout(game),
    length = trackLength(game),
    order = colorOrder(game);
  return (
    <svg
      className="board"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label={`Plateau TAC-TIK ${order.length} couleurs, ${length} cases`}
    >
      <defs>
        <linearGradient id="timber" x2=".8" y2="1">
          <stop stopColor="#e4c795" />
          <stop offset=".45" stopColor="#f2dbb1" />
          <stop offset="1" stopColor="#d9b982" />
        </linearGradient>
        <pattern id="grain" width="79" height="200" patternUnits="userSpaceOnUse">
          <path
            d="M3 -20 Q18 50 5 130 T8 220 M21 -20 Q9 70 25 170 T23 240 M43 -20 Q57 90 41 180 T44 220 M65 -20 Q53 50 69 140 T67 220"
            fill="none"
            stroke="#8c6536"
            strokeOpacity=".12"
          />
          <path d="M12 20v25m20 46v50m18-100v27m22 62v42" stroke="#866236" strokeOpacity=".2" />
        </pattern>
        <radialGradient id="hole">
          <stop stopColor="#57402b" />
          <stop offset=".7" stopColor="#88653f" />
          <stop offset="1" stopColor="#af8a58" />
        </radialGradient>
        <filter id="peg-shadow">
          <feDropShadow dx="1" dy="3" stdDeviation="1.5" floodOpacity=".25" />
        </filter>
      </defs>
      <rect
        x="3"
        y="3"
        width={layout.width - 6}
        height="594"
        rx="4"
        fill="url(#timber)"
        stroke="#b38f5e"
        strokeWidth="3"
      />
      <rect x="3" y="3" width={layout.width - 6} height="594" rx="4" fill="url(#grain)" />
      {layout.seams.map((x) => (
        <path key={x} d={`M${x} 4V596`} stroke="#715536" strokeOpacity=".25" strokeWidth="2" />
      ))}
      {layout.track.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill="url(#hole)" stroke="#f6e4c7" strokeWidth="1.4" />
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
        const horizontal = reserve[0][1] === reserve[1][1];
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
                fill="url(#hole)"
                stroke="#f5dcac"
                strokeWidth="1"
              />
            ))}
            <rect
              x={minX - 18}
              y={minY - 19}
              width={horizontal ? 96 : 36}
              height={horizontal ? 38 : 98}
              rx="12"
              fill="#342e24"
              stroke={PALETTE[c]}
              strokeWidth="5"
            />
          </g>
        );
      })}
      <text
        x={layout.width / 2}
        y="254"
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontSize="26"
        fill="#493a25"
        letterSpacing="3"
      >
        TAC✳TIK
      </text>
      <g transform={`translate(${layout.width / 2 - 43},275)`}>
        <rect width="40" height="64" rx="5" fill="#263e34" stroke="#f0e4c8" strokeWidth="3" />
        <text x="20" y="38" textAnchor="middle" fill="#e6d5ad" fontSize="18">
          ✳
        </text>
      </g>
      <g transform={`translate(${layout.width / 2 + 8},275)`}>
        <rect width="40" height="64" rx="5" fill="#fbf4e6" stroke="#a48d65" />
        <text
          x="20"
          y="38"
          textAnchor="middle"
          fill="#493b29"
          fontFamily="Georgia,serif"
          fontSize="21"
        >
          {game.discard.length ? cardSymbol(game.discard.at(-1)!) : ''}
        </text>
      </g>
      {game.pieces.map((p) => {
        const n = Number(p.id.split('-')[1]);
        const [x, y] =
          p.position < 0
            ? layout.reserves[p.color][n]
            : p.position >= length
              ? layout.homes[p.color][p.position - length]
              : layout.track[p.position];
        const enabled = playable.includes(p.id),
          horizontal =
            p.position < 0 && layout.reserves[p.color][0][0] === layout.reserves[p.color][1][0];
        return (
          <g
            key={p.id}
            role="button"
            tabIndex={enabled ? 0 : -1}
            aria-disabled={!enabled}
            aria-label={`${COLOR_NAMES[p.color]} ${n + 1}, ${p.position < 0 ? 'réserve' : p.position >= length ? 'maison' : p.stake ? 'pieu' : 'parcours'}`}
            onClick={() => enabled && onPiece(p.id)}
            onKeyDown={(e) => {
              if (enabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPiece(p.id);
              }
            }}
            className={enabled ? 'peg selectable' : 'peg'}
          >
            {(enabled || selected === p.id) && (
              <circle
                cx={x}
                cy={y}
                r="19"
                fill="#fff9"
                stroke="#184a77"
                strokeWidth="2"
                strokeDasharray={selected === p.id ? undefined : '3 3'}
              />
            )}
            <g
              transform={`translate(${x},${y}) rotate(${horizontal ? 90 : 0})`}
              filter="url(#peg-shadow)"
            >
              <rect
                x="-8"
                y="-13"
                width="16"
                height="26"
                rx="5"
                fill={PALETTE[p.color]}
                stroke="#2228"
              />
              <ellipse cy="-8" rx="7" ry="4" fill={PALETTE[p.color]} stroke="#fff5" />
              {p.stake && <ellipse cy="-8" rx="3.5" ry="2.3" fill="#1e1b16" />}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
