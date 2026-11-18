'use client';

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="app recovery-page" role="alert">
      <h1>L'affichage du jeu a été interrompu</h1>
      <p>
        En ligne, votre place et les coups enregistrés sont conservés. Reprenez la page avec ce
        navigateur, sans effacer sa session.
      </p>
      <button className="primary" onClick={() => retry()}>
        Reprendre la page
      </button>
      <button onClick={() => location.reload()}>Recharger ce salon</button>
      <p className="muted">Une partie d'entraînement locale ne survit pas au rechargement.</p>
    </main>
  );
}
