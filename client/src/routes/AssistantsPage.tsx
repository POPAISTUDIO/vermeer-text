import { useMemo, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { Plus } from 'lucide-react';
import type t from 'librechat-data-provider';
import { useGetEndpointsQuery } from '~/data-provider';
import { useLocalize, useAgentCategories } from '~/hooks';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import CategoryTabs from '~/components/Agents/CategoryTabs';
import OwnershipFilterSelect, { OwnershipFilter } from '~/components/Agents/OwnershipFilter';
import AgentGrid from '~/components/Agents/AgentGrid';
import store from '~/store';

// Vermeer: la page « Assistants » EST le Marketplace refondu, rendue DANS le layout
// principal (sidebar mono-colonne à gauche via Root). On réutilise la grille Marketplace
// (AgentGrid : tous les assistants accessibles en VIEW, filtrés par catégorie) et ses
// cartes (dialogue détail avec actions role-based déjà en place : « Démarrer une
// conversation » pour tous, « Conversations partagées » pour tous, « Paramètres de
// l'assistant » pour les miens/admin — cf. AgentDetailContent). Wrappée dans
// MarketplaceProvider pour fournir le ChatContext requis par le démarrage de conversation.
// « Créer un assistant » ouvre la modale builder via le pont Recoil ('' = form vierge).
function AssistantsPageContent() {
  const localize = useLocalize();
  const setOpenBuilder = useSetRecoilState(store.openBuilderModal);
  const { categories: vermeerCategories } = useAgentCategories();
  const [activeTab, setActiveTab] = useState('all');
  // Vermeer: filtre de propriété (Tous / Partagés / Mes assistants), état local non persisté.
  const [ownership, setOwnership] = useState<OwnershipFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // AgentGrid dépend de la config endpoints (queries agents) — s'assurer qu'elle charge.
  useGetEndpointsQuery();

  const marketplaceCategories = useMemo<t.TMarketplaceCategory[]>(
    () => [
      { value: 'all', label: 'all', count: 0 },
      ...vermeerCategories.map((c) => ({
        value: c.value,
        label: c.label,
        description: c.description,
        count: 0,
      })),
    ],
    [vermeerCategories],
  );

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto bg-surface-primary px-6 py-6 text-text-primary"
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpenBuilder('')}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {localize('com_vermeer_create_assistant')}
          </button>
          <h1 className="text-2xl font-semibold">{localize('com_vermeer_nav_assistants')}</h1>
        </header>

        {/* Vermeer: onglets catégories + filtre de propriété (dropdown) sur la MÊME rangée,
            filtre aligné à droite. CategoryTabs gère son propre overflow horizontal en étroit. */}
        <div className="mb-4 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CategoryTabs
              categories={marketplaceCategories}
              activeTab={activeTab}
              isLoading={false}
              onChange={setActiveTab}
            />
          </div>
          <div className="shrink-0">
            <OwnershipFilterSelect value={ownership} onChange={setOwnership} />
          </div>
        </div>

        <AgentGrid
          category={activeTab}
          searchQuery=""
          ownership={ownership}
          onSelectAgent={() => undefined}
          scrollElementRef={scrollRef}
        />
      </div>
    </div>
  );
}

export default function AssistantsPage() {
  return (
    <MarketplaceProvider>
      <AssistantsPageContent />
    </MarketplaceProvider>
  );
}
