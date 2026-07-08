import { useLocalize } from '~/hooks';

// Vermeer: page pleine « Assistants » rendue DANS le layout principal (sidebar
// mono-colonne à gauche via Root, contenu ici dans l'Outlet). Remplace le panneau
// latéral provisoire. Le contenu riche (builder + liste + Marketplace) arrive au
// commit 6 ; ceci est le shell d'infrastructure.
export default function AssistantsPage() {
  const localize = useLocalize();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-text-primary">
      <h1 className="text-xl font-semibold">{localize('com_vermeer_nav_assistants')}</h1>
    </div>
  );
}
