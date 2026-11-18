'use client';
import type { Game } from '@/game/types';
import { cardSymbol, cardTitle } from '@/game/labels';

// Intentionally accepts a local Game only. Never feed this data from a room API.
export function BotHands({ game }: { game: Game }) {
  return (
    <section className="bot-hands" aria-label="Cartes des bots en entraînement">
      <h2>Cartes des bots</h2>
      <p className="muted">Observation locale. Les bots ne voient toujours que leur propre main.</p>
      {game.players
        .filter((p) => p.bot)
        .map((p) => {
          const seat = game.players.findIndex((q) => q.id === p.id);
          return (
            <div key={p.id}>
              <b>{p.name}</b>
              <div className="bot-cards">
                {game.hands[seat].map((c, i) => (
                  <span key={i} title={cardTitle(c)}>
                    {cardSymbol(c)}
                  </span>
                ))}
                {!game.hands[seat].length && <small>Main vide</small>}
              </div>
            </div>
          );
        })}
    </section>
  );
}
