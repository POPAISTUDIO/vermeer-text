import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { Bot, Store, Settings2, Share2, Plus } from 'lucide-react';
import { Spinner } from '@librechat/client';
import { useListAgentsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import store from '~/store';

// Vermeer: page pleine « Assistants » (réf. section Projets de Claude.ai), rendue DANS
// le layout principal (sidebar mono-colonne à gauche via Root, contenu ici). Liste MES
// assistants en cartes. Par carte : « Configurer » ouvre la modale builder via le pont
// Recoil `openBuilderModal` (le builder NE vit PAS ici — couplé à ChatContext, il
// crashe hors sidebar ; il reste dans la modale de MonoSidebar) ; « Conversations
// partagées » ouvre la vue existante /agents/:id/shared-conversations.
// Historique perso par assistant : OMIS (pas de filtre agent_id backend → v0.10.20).
export default function AssistantsPage() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const setOpenBuilder = useSetRecoilState(store.openBuilderModal);
  const { data, isLoading } = useListAgentsQuery();
  const agents = data?.data ?? [];

  const openBuilder = () => setOpenBuilder(true);

  return (
    <div className="h-full overflow-y-auto bg-surface-primary px-6 py-6 text-text-primary">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{localize('com_vermeer_nav_assistants')}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/agents')}
              className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              {localize('com_agents_marketplace')}
            </button>
            <button
              type="button"
              onClick={openBuilder}
              className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-surface-hover"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {localize('com_vermeer_create_assistant')}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="text-text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-3 rounded-xl border border-border-light bg-surface-primary-alt p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-active-alt">
                    <Bot className="h-5 w-5 text-text-primary" aria-hidden="true" />
                  </span>
                  <h2 className="truncate text-sm font-semibold">{agent.name}</h2>
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-xs text-text-secondary">
                  {agent.description}
                </p>
                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openBuilder}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-light px-2 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {localize('com_vermeer_configure')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/agents/${agent.id}/shared-conversations`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-light px-2 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {localize('com_vermeer_shared_conversations')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
