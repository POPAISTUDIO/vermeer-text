import { lazy, Suspense } from 'react';
import { Spinner } from '@librechat/client';

// Vermeer: page pleine « Assistants » rendue DANS le layout principal (sidebar
// mono-colonne à gauche via Root, contenu ici dans l'Outlet). AgentPanelSwitch est
// autonome (wrappe son AgentPanelProvider + son propre FormProvider) et n'utilise
// PAS ChatContext (ses composants fichiers passent par les variantes NoChatContext),
// donc montable en page. Il embarque déjà le sélecteur d'assistants (AgentSelect =
// « Mes assistants ») et l'accès Marketplace ; on le rend simplement en pleine page.
const AgentPanelSwitch = lazy(() => import('~/components/SidePanel/Agents/AgentPanelSwitch'));

export default function AssistantsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden text-text-primary">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col px-4 py-4">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner className="text-text-primary" />
            </div>
          }
        >
          <AgentPanelSwitch />
        </Suspense>
      </div>
    </div>
  );
}
