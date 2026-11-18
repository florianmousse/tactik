'use client';
import { colorOrder, startPosition, trackLength } from '@/game/engine';
import type { View } from '@/game/types';
export const PALETTE = ['#d35e49', '#d6a02d', '#447dba', '#398474', '#55556b', '#e9e3d2'];
export const COLOR_NAMES = ['Corail', 'Miel', 'Azur', 'Sauge', 'Ardoise', 'Ivoire'];
function point(angle: number, radius: number): [number, number] {
  return [400 + Math.cos(angle) * radius, 350 + Math.sin(angle) * radius * 0.84];
}
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
  const length = trackLength(game),
    order = colorOrder(game),
    angle = (pos: number) => (pos / length) * Math.PI * 2 + Math.PI / 2;
  const coordinates = (color: number, pos: number, number: number): [number, number] => {
    const a = angle(startPosition(game, color));
    if (pos === -1) {
      const [x, y] = point(a, 360);
      return [
        x + Math.cos(a + Math.PI / 2) * (number - 1.5) * 21,
        y + Math.sin(a + Math.PI / 2) * (number - 1.5) * 21,
      ];
    }
    if (pos >= length) return point(a + 0.13, 265 - (pos - length) * 28);
    return point(angle(pos), 310);
  };
  return (
    <svg
      className="board"
      viewBox="0 0 800 700"
      role="group"
      aria-label="Plateau TAC-TIK, parcours et maisons"
    >
      <defs>
        <pattern id="wood" width="160" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M0 3 Q50 7 160 3 M0 10 Q90 6 160 10"
            fill="none"
            stroke="#9e7547"
            strokeOpacity=".075"
          />
        </pattern>
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".25" />
        </filter>
        <radialGradient id="timber">
          <stop stopColor="#f4dfb9" />
          <stop offset="1" stopColor="#dbc092" />
        </radialGradient>
      </defs>
      <rect
        x="8"
        y="8"
        width="784"
        height="684"
        rx="44"
        fill="url(#timber)"
        stroke="#b79b72"
        strokeWidth="2"
      />
      <rect x="8" y="8" width="784" height="684" rx="44" fill="url(#wood)" />
      <rect
        x="22"
        y="22"
        width="756"
        height="656"
        rx="33"
        fill="none"
        stroke="#99794e"
        strokeOpacity=".25"
      />
      <ellipse
        cx="400"
        cy="350"
        rx="310"
        ry="260.4"
        fill="none"
        stroke="#987345"
        strokeOpacity=".13"
        strokeWidth="2"
      />
      {Array.from({ length }, (_, pos) => {
        const [x, y] = coordinates(0, pos, 0);
        const start = order.find((c) => startPosition(game, c) === pos);
        return (
          <g key={pos}>
            <circle cx={x} cy={y} r="7" fill="#80633e" fillOpacity=".55" />
            {pos % 4 === 0 && (
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="none"
                stroke={start === undefined ? '#80633e' : PALETTE[start]}
                strokeWidth={start === undefined ? 1 : 3}
              />
            )}
          </g>
        );
      })}
      {order.map((c) => (
        <g key={c}>
          {Array.from({ length: 4 }, (_, n) => {
            const [x, y] = coordinates(c, length + n, n),
              [rx, ry] = coordinates(c, -1, n);
            return (
              <g key={n}>
                <circle cx={x} cy={y} r="10" fill={PALETTE[c]} opacity=".28" />
                <circle cx={x} cy={y} r="6" fill="#80633e" fillOpacity=".5" />
                <rect
                  x={rx - 8}
                  y={ry - 14}
                  width="16"
                  height="28"
                  rx="6"
                  fill={PALETTE[c]}
                  opacity=".18"
                />
              </g>
            );
          })}
        </g>
      ))}
      <text x="400" y="326" textAnchor="middle" className="board-word">
        TAC<tspan fill="#bd6d42">✳</tspan>TIK
      </text>
      <text x="400" y="355" textAnchor="middle" className="board-caption">
        UN PEU DE CHANCE. BEAUCOUP DE MALICE.
      </text>
      <path d="M365 379 H435" stroke="#9a7b53" strokeOpacity=".5" />
      <text x="400" y="405" textAnchor="middle" className="board-caption">
        {length} CASES · {order.length} COULEURS
      </text>
      {game.pieces.map((p) => {
        const [x, y] = coordinates(p.color, p.position, Number(p.id.split('-')[1]));
        const enabled = playable.includes(p.id);
        return (
          <g
            key={p.id}
            role="button"
            tabIndex={enabled ? 0 : -1}
            aria-disabled={!enabled}
            aria-label={`${COLOR_NAMES[p.color]} ${Number(p.id.split('-')[1]) + 1}, ${p.position === -1 ? 'réserve' : p.position >= length ? 'maison' : p.stake ? 'pieu' : 'parcours'}`}
            onClick={() => enabled && onPiece(p.id)}
            onKeyDown={(e) => {
              if (enabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPiece(p.id);
              }
            }}
            className={enabled ? 'piece playable' : 'piece'}
          >
            {(enabled || selected === p.id) && (
              <circle
                cx={x}
                cy={y}
                r="17"
                fill="none"
                stroke={selected === p.id ? '#fdfbf6' : '#224c40'}
                strokeWidth="2.5"
                strokeDasharray={selected === p.id ? undefined : '3 3'}
              />
            )}
            <rect
              x={x - 8}
              y={y - 12}
              width="16"
              height="24"
              rx="6"
              fill={PALETTE[p.color]}
              stroke="#302b24"
              strokeOpacity=".25"
              filter="url(#shadow)"
            />
            <ellipse
              cx={x}
              cy={y - 7}
              rx="5"
              ry="3"
              fill={p.stake ? '#28241f' : '#fff'}
              opacity={p.stake ? 0.8 : 0.3}
            />
            <title>
              {COLOR_NAMES[p.color]} {Number(p.id.split('-')[1]) + 1}
              {p.stake ? ' • Pieu protégé' : ''}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
