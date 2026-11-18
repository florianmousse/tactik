'use client';
import type { View } from '@/game/types';
import type { RoomView, Presence } from '@/game/room';
import { PALETTE, COLOR_NAMES } from './board';

export const PRESENCE_LABELS: Record<Presence, string> = {
  online: 'Présent',
  away: 'En arrière-plan',
  offline: 'Absent',
  bot: 'Bot',
};
export function PlayerList({
  view,
  room,
  local,
}: {
  view: View;
  room: RoomView | null;
  local: boolean;
}) {
  const players = view.players.map((player, seat) => ({ player, seat }));
  players.sort((a, b) => Number(b.seat === view.me) - Number(a.seat === view.me));
  const me = view.players[view.me];
  const partner = view.players.find((p, i) => i !== view.me && p.team === me.team);
  return (
    <div className="players">
      {players.map(({ player: p, seat }) => {
        const presence = p.bot
          ? 'bot'
          : local
            ? 'online'
            : (room?.people[seat]?.presence ?? 'offline');
        return (
          <div
            key={p.id}
            className={`player ${seat === view.me ? 'self' : ''} ${view.phase === 'play' && view.turn === seat ? 'current' : ''}`}
          >
            <span className="color-dots">
              {p.colors.map((c) => (
                <i key={c} title={COLOR_NAMES[c]} style={{ background: PALETTE[c] }} />
              ))}
            </span>
            <b>
              {p.name}
              {seat === view.me ? ' (vous)' : ''}
            </b>
            <span className={`presence ${presence}`}>{PRESENCE_LABELS[presence]}</span>
            <small>
              {p.colors.map((c) => COLOR_NAMES[c]).join(' + ')} · {view.handCounts[seat]} cartes
              {view.phase === 'exchange' && view.exchanged[seat] ? ' ✓' : ''}
            </small>
            {seat === view.me && (
              <strong className="partner-label">
                {partner
                  ? `Votre coéquipier : ${partner.name} (${partner.colors.map((c) => COLOR_NAMES[c]).join(', ')})`
                  : 'Vous jouez vos deux couleurs'}
              </strong>
            )}
          </div>
        );
      })}
    </div>
  );
}
