import { useLocalize } from '~/hooks';

// Vermeer: page pleine « Assistants » — REPORTÉE. Le builder (AgentPanelSwitch →
// AgentConfig) rend les paramètres modèle via le sous-système Parameters
// (componentMapping → widgets Dynamic*), qui consomment `useChatContext` et écrivent
// via `useSetIndexOptions`. Hors du panneau (qui vit sous SidebarChatProvider), ça
// crashe « useChatContext must be used within a ChatContext.Provider ». Aucune
// variante NoChatContext n'existe pour ces widgets, et un provider inerte casserait
// la persistance des params. Décision : l'entrée nav Assistants reste au panneau
// latéral provisoire ; cette page reste un shell inerte jusqu'à traitement dédié.
export default function AssistantsPage() {
  const localize = useLocalize();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-text-primary">
      <h1 className="text-xl font-semibold">{localize('com_vermeer_nav_assistants')}</h1>
    </div>
  );
}
