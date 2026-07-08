import { useLocalize } from '~/hooks';

// Vermeer: page pleine « Consommation » rendue DANS le layout principal (sidebar
// mono-colonne à gauche via Root, contenu ici dans l'Outlet). Le dashboard Usage
// arrive au commit 7 ; ceci est le shell d'infrastructure.
export default function ConsumptionPage() {
  const localize = useLocalize();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-text-primary">
      <h1 className="text-xl font-semibold">{localize('com_vermeer_nav_usage')}</h1>
    </div>
  );
}
