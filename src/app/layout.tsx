import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'TacTik — À vous de jouer malin',
  description:
    'Votre table de TAC-TIK en ligne. Créez une partie privée et retrouvez vos amis autour du plateau.',
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
