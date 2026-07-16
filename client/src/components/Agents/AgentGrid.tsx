import React, { useMemo, useEffect, useContext } from 'react';
import { Spinner } from '@librechat/client';
import { PermissionBits } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useMarketplaceAgentsInfiniteQuery } from '~/data-provider/Agents';
import { useAgentCategories, useLocalize, AuthContext } from '~/hooks';
import { expandCategoryValue } from '~/constants/agentCategories';
import { useInfiniteScroll } from '~/hooks/useInfiniteScroll';
import type { OwnershipFilter } from './OwnershipFilter';
import { useHasData } from './SmartLoader';
import ErrorDisplay from './ErrorDisplay';
import AgentCard from './AgentCard';

interface AgentGridProps {
  category: string;
  searchQuery: string;
  ownership?: OwnershipFilter;
  onSelectAgent: (agent: t.Agent) => void;
  scrollElementRef?: React.RefObject<HTMLElement>;
}

/**
 * Component for displaying a grid of agent cards
 */
const AgentGrid: React.FC<AgentGridProps> = ({
  category,
  searchQuery,
  ownership = 'all',
  onSelectAgent,
  scrollElementRef,
}) => {
  const localize = useLocalize();
  // Vermeer: lecture DÉFENSIVE du contexte d'auth via useContext (et non useAuthContext,
  // qui throw hors AuthProvider). AgentGrid peut être monté sans provider (tests, previews) ;
  // on ne veut pas crasher la page Assistants. Sans user, le filtre de propriété se désactive
  // simplement (fallback = tous les assistants chargés, cf. currentAgents ci-dessous).
  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  // Get category data from API
  const { categories } = useAgentCategories();

  // Build query parameters based on current state
  const queryParams = useMemo(() => {
    const params: {
      requiredPermission: number;
      category?: string;
      search?: string;
      limit: number;
      promoted?: 0 | 1;
    } = {
      requiredPermission: PermissionBits.VIEW, // View permission for marketplace viewing
      limit: 6,
    };

    // Vermeer: on envoie la catégorie canonique v2 étendue à ses alias DB (elle-même +
    // valeurs v1/legacy remappées), en liste séparée par des virgules. Le backend fait un
    // $in, ce qui garde les assistants existants comptés dans le bon onglet (ex. 'media'
    // sous 'production') tout en préservant la pagination serveur.
    // Handle search
    if (searchQuery) {
      params.search = searchQuery;
      // Include category filter for search if it's not 'all' or 'promoted'
      if (category !== 'all' && category !== 'promoted') {
        params.category = expandCategoryValue(category).join(',');
      }
    } else {
      // Handle category-based queries
      if (category === 'promoted') {
        params.promoted = 1;
      } else if (category !== 'all') {
        params.category = expandCategoryValue(category).join(',');
      }
      // For 'all' category, no additional filters needed
    }

    return params;
  }, [category, searchQuery]);

  // Use infinite query for marketplace agents
  const {
    data,
    isLoading,
    error,
    isFetching,
    fetchNextPage,
    hasNextPage,
    refetch,
    isFetchingNextPage,
  } = useMarketplaceAgentsInfiniteQuery(queryParams);

  // Flatten all pages into a single array of agents
  const loadedAgents = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data || []);
  }, [data?.pages]);

  // Vermeer: filtre de propriété appliqué CÔTÉ CLIENT sur les pages chargées
  // (useMarketplaceAgentsInfiniteQuery n'expose pas de filtre par auteur, et
  // « shared » = complément non exprimable côté serveur). Limite connue : la
  // pagination infinie fetch par pages non filtrées, donc le nombre d'assistants
  // affichés par page peut varier selon le filtre.
  const currentAgents = useMemo(() => {
    if (ownership === 'all' || !user?.id) {
      return loadedAgents;
    }
    if (ownership === 'mine') {
      return loadedAgents.filter((agent) => agent.author === user.id);
    }
    return loadedAgents.filter((agent) => agent.author !== user.id);
  }, [loadedAgents, ownership, user?.id]);

  // Check if we have meaningful data to prevent unnecessary loading states
  const hasData = useHasData(data?.pages?.[0]);

  // Set up infinite scroll
  const { setScrollElement } = useInfiniteScroll({
    hasNextPage,
    isLoading: isFetching || isFetchingNextPage,
    fetchNextPage: () => {
      if (hasNextPage && !isFetching) {
        fetchNextPage();
      }
    },
    threshold: 0.8, // Trigger when 80% scrolled
    throttleMs: 200,
  });

  // Connect the scroll element when it's provided
  useEffect(() => {
    const scrollElement = scrollElementRef?.current;
    if (scrollElement) {
      setScrollElement(scrollElement);
    }
  }, [scrollElementRef, setScrollElement]);

  /**
   * Get category display name from API data or use fallback
   */
  const getCategoryDisplayName = (categoryValue: string) => {
    const categoryData = categories.find((cat) => cat.value === categoryValue);
    if (categoryData) {
      return categoryData.label;
    }

    // Fallback for special categories or unknown categories
    if (categoryValue === 'promoted') {
      return localize('com_agents_top_picks');
    }
    if (categoryValue === 'all') {
      return 'All';
    }

    // Simple capitalization for unknown categories
    return categoryValue.charAt(0).toUpperCase() + categoryValue.slice(1);
  };

  // Simple loading spinner
  const loadingSpinner = (
    <div className="flex justify-center py-12">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );

  // Handle error state with enhanced error display
  if (error) {
    return (
      <ErrorDisplay
        error={error || 'Unknown error occurred'}
        onRetry={() => refetch()}
        context={{
          searchQuery,
          category,
        }}
      />
    );
  }

  // Main content component with proper semantic structure
  const mainContent = (
    <div
      className="space-y-6"
      role="tabpanel"
      id={`category-panel-${category}`}
      aria-labelledby={`category-tab-${category}`}
      aria-live="polite"
      aria-busy={isLoading && !hasData}
    >
      {/* Handle empty results with enhanced accessibility */}
      {(!currentAgents || currentAgents.length === 0) && !isLoading && !isFetching ? (
        <div
          className="py-12 text-center text-text-secondary"
          role="status"
          aria-live="polite"
          aria-label={
            searchQuery
              ? localize('com_agents_search_empty_heading')
              : localize('com_agents_empty_state_heading')
          }
        >
          <h3 className="mb-2 text-lg font-medium">{localize('com_agents_empty_state_heading')}</h3>
        </div>
      ) : (
        <>
          {/* Announcement for screen readers */}
          <div id="search-results-count" className="sr-only" aria-live="polite" aria-atomic="true">
            {localize('com_agents_grid_announcement', {
              count: currentAgents?.length || 0,
              category: getCategoryDisplayName(category),
            })}
          </div>

          {/* Agent grid - 2 per row with proper semantic structure */}
          {currentAgents && currentAgents.length > 0 && (
            <div
              className="mx-4 grid grid-cols-1 gap-6 md:grid-cols-2"
              role="grid"
              aria-label={localize('com_agents_grid_announcement', {
                count: currentAgents.length,
                category: getCategoryDisplayName(category),
              })}
            >
              {currentAgents.map((agent: t.Agent, index: number) => (
                <div key={`${agent.id}-${index}`} role="gridcell">
                  <AgentCard agent={agent} onSelect={onSelectAgent} />
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator when fetching more with accessibility */}
          {isFetchingNextPage && (
            <div
              className="flex justify-center py-8"
              role="status"
              aria-live="polite"
              aria-label={localize('com_agents_loading')}
            >
              <Spinner className="h-6 w-6 text-primary" />
              <span className="sr-only">{localize('com_agents_loading')}</span>
            </div>
          )}

          {/* End of results indicator */}
          {!hasNextPage && currentAgents && currentAgents.length > 0 && (
            <div className="mt-8 text-center">
              <p className="text-sm text-text-secondary">
                {localize('com_agents_no_more_results')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (isLoading || (isFetching && !isFetchingNextPage)) {
    return loadingSpinner;
  }
  return mainContent;
};

export default AgentGrid;
