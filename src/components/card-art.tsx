import type { Card } from '@/game/types';
import { cardSymbol } from '@/game/labels';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

function Tile({ value, transform }: { value: number | string; transform: string }) {
  return (
    <g transform={transform}>
      <rect x="-14" y="-13" width="29" height="29" rx="4" fill="#baa78b" />
      <rect x="-15" y="-15" width="29" height="28" rx="4" fill="#e9cea5" stroke="#d5b88f" />
      {typeof value === 'number' ? (
        pips[value].map((i) => (
          <circle key={i} cx={((i % 3) - 1) * 7} cy={(Math.floor(i / 3) - 1) * 7} r="2.8" />
        ))
      ) : (
        <text textAnchor="middle" y="6" fontSize="17">
          {value}
        </text>
      )}
    </g>
  );
}

export function CardFace({ card }: { card: Card }) {
  const start = card === 1 || card === 10;
  const ink =
    card === 'swap' || card === 'joker'
      ? '#77469c'
      : card === -4 || card === 7
        ? '#bc382d'
        : '#287449';
  const lines = start
    ? ['AVANCER OU', 'DÉMARRER']
    : card === 'swap'
      ? ['PERMUTER', '2 PIONS']
      : card === 7
        ? ['RÉPARTIR', 'ET CAPTURER']
        : card === 'joker'
          ? ['JOKER']
          : [card === -4 ? 'RECULER' : 'AVANCER'];
  const tiles =
    card === 'joker'
      ? ['★']
      : card === 'swap'
        ? ['↱', '↲']
        : card === 7
          ? [1, '×7']
          : card === -4
            ? [2, 2]
            : card > 6
              ? [Math.ceil(card / 2), Math.floor(card / 2)]
              : [card];
  return (
    <svg
      viewBox="0 0 84 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      fill="#211c19"
      fontFamily="Arial,sans-serif"
      fontWeight="bold"
    >
      <rect x=".7" y=".7" width="82.6" height="118.6" rx="8" fill="#fffefa" stroke="#d4ccbc" />
      {[0, 180].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 42 60)`}>
          {[5, 79].map((x) => (
            <g key={x}>
              <text x={x} y="16" textAnchor={x === 5 ? 'start' : 'end'} fill={ink} fontSize="15">
                {cardSymbol(card)}
              </text>
              {start && (
                <g transform={`translate(${x === 5 ? 11 : 73} 24)`}>
                  <circle r="6" fill="#efd17d" stroke="#af8331" />
                  <text y="3" textAnchor="middle" fontSize="8">
                    D
                  </text>
                </g>
              )}
            </g>
          ))}
          {lines.map((line, i) => (
            <text
              key={line}
              x="42"
              y={lines.length === 1 ? 32 : 26 + i * 11}
              textAnchor="middle"
              fontSize="10"
              textLength={line.length * 5.6}
              lengthAdjust="spacingAndGlyphs"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
      {tiles.map((v, i) => (
        <Tile
          key={i}
          value={v}
          transform={
            tiles.length === 1
              ? 'translate(42 60) rotate(-4)'
              : i === 0
                ? 'translate(24 56) rotate(4)'
                : 'translate(59 65) rotate(-5)'
          }
        />
      ))}
    </svg>
  );
}

export function CardBack() {
  return (
    <svg viewBox="0 0 60 90" width="100%" height="100%" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="58"
        height="88"
        rx="5"
        fill="#192322"
        stroke="#cbae70"
        strokeWidth="2"
      />
      <rect x="4" y="4" width="52" height="82" rx="4" fill="none" stroke="#d4b679" />
      {[0, 180].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 30 45)`} fill="none" stroke="#d4b679">
          <path d="M8 25 Q8 10 19 9 Q16 19 10 17 Q9 13 13 13 M52 25 Q52 10 41 9 Q44 19 50 17 Q51 13 47 13 M24 12 l6 -4 6 4 -6 4z" />
          <text
            x="30"
            y="38"
            fill="#ead3a2"
            stroke="none"
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
          >
            TAC★TIK
          </text>
        </g>
      ))}
      <path d="m30 41 5 4-5 4-5-4z" fill="#e7c77f" />
    </svg>
  );
}
