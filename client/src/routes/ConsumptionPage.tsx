import { lazy, Suspense } from 'react';
import { Spinner } from '@librechat/client';

// Vermeer: page pleine « Consommation » rendue DANS le layout principal (sidebar
// mono-colonne à gauche via Root, contenu ici dans l'Outlet). Usage est déjà une page
// routée autonome (/d/usage sous DashboardRoute, qui ne fournit qu'un garde d'auth) —
// aucun couplage ChatContext ni provider Dashboard —, donc réutilisable directement.
// Il porte son propre header (« Consommation »), sa hauteur, son scroll et son fond.
const Usage = lazy(() => import('~/components/Admin/Usage'));

export default function ConsumptionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner className="text-text-primary" />
        </div>
      }
    >
      <Usage />
    </Suspense>
  );
}
