import { useCallback, useEffect, useState, useMemo, memo, useRef } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { useMediaQuery } from '@librechat/client';
import type { InfiniteQueryObserverResult } from '@tanstack/react-query';
import type { ConversationListResponse } from 'librechat-data-provider';
import type { List } from 'react-virtualized';
import {
  useLocalize,
  useAuthContext,
  useLocalStorage,
  useNavScrolling,
  usePinnedConversations,
} from '~/hooks';
import { useConversationsInfiniteQuery, useTitleGeneration } from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import PinnedGroup from '~/components/UnifiedSidebar/PinnedGroup';
import SearchBar from '~/components/Nav/SearchBar';
import store from '~/store';

const ConversationsSection = memo(() => {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const setSidebarExpanded = useSetRecoilState(store.sidebarExpanded);
  const { isAuthenticated } = useAuthContext();
  useTitleGeneration(isAuthenticated);

  const [isChatsExpanded, setIsChatsExpanded] = useLocalStorage('chatsExpanded', true);
  const [showLoading, setShowLoading] = useState(false);

  const search = useRecoilValue(store.search);
  // Vermeer: conversations épinglées (user-scopé). Sorties des groupes de date et
  // regroupées au-dessus ; masquées pendant une recherche pour ne pas amputer les résultats.
  const { pinnedIds } = usePinnedConversations();
  const showPinned = !search.query && pinnedIds.length > 0;
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const { data, fetchNextPage, isFetchingNextPage, isLoading, isFetching } =
    useConversationsInfiniteQuery(
      {
        tags: undefined,
        search: search.debouncedQuery || undefined,
      },
      {
        enabled: isAuthenticated,
        staleTime: 30000,
        cacheTime: 300000,
      },
    );

  const computedHasNextPage = useMemo(() => {
    if (data?.pages && data.pages.length > 0) {
      const lastPage: ConversationListResponse = data.pages[data.pages.length - 1];
      return lastPage.nextCursor !== null;
    }
    return false;
  }, [data?.pages]);

  const conversationsRef = useRef<List | null>(null);

  const { moveToTop } = useNavScrolling<ConversationListResponse>({
    setShowLoading,
    fetchNextPage: async (options?) => {
      if (computedHasNextPage) {
        return fetchNextPage(options);
      }
      return Promise.resolve({} as InfiniteQueryObserverResult<ConversationListResponse, unknown>);
    },
    isFetchingNext: isFetchingNextPage,
  });

  const conversations = useMemo(() => {
    const all = data ? data.pages.flatMap((page) => page.conversations) : [];
    // Vermeer: retire les épinglées des groupes de date (elles vivent dans le groupe Épinglés).
    if (!showPinned) {
      return all;
    }
    return all.filter((convo) => !(convo && pinnedSet.has(convo.conversationId ?? '')));
  }, [data, showPinned, pinnedSet]);

  const toggleNav = useCallback(() => {
    if (isSmallScreen) {
      setSidebarExpanded(false);
    }
  }, [isSmallScreen, setSidebarExpanded]);

  const loadMoreConversations = useCallback(() => {
    if (isFetchingNextPage || !computedHasNextPage) {
      return;
    }
    fetchNextPage();
  }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

  const [isSearchLoading, setIsSearchLoading] = useState(
    !!search.query && (search.isTyping || isLoading || isFetching),
  );

  useEffect(() => {
    if (search.isTyping) {
      setIsSearchLoading(true);
    } else if (!isLoading && !isFetching) {
      setIsSearchLoading(false);
    } else if (!!search.query && (isLoading || isFetching)) {
      setIsSearchLoading(true);
    }
  }, [search.query, search.isTyping, isLoading, isFetching]);

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden pb-3"
      role="region"
      aria-label={localize('com_ui_chat_history')}
    >
      {/* Vermeer: header hérité épuré — BookmarkNav orphelin retiré (Signets hors rail) */}
      <div className="flex items-center gap-0.5 px-3">
        {search.enabled && <SearchBar isSmallScreen={isSmallScreen} />}
      </div>
      {/* Vermeer: groupe « Épinglés » au-dessus des groupes de date */}
      {showPinned && (
        <PinnedGroup pinnedIds={pinnedIds} retainView={moveToTop} toggleNav={toggleNav} />
      )}
      <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
        <Conversations
          conversations={conversations}
          moveToTop={moveToTop}
          toggleNav={toggleNav}
          containerRef={conversationsRef}
          loadMoreConversations={loadMoreConversations}
          isLoading={isFetchingNextPage || showLoading || isLoading}
          isSearchLoading={isSearchLoading}
          isChatsExpanded={isChatsExpanded}
          setIsChatsExpanded={setIsChatsExpanded}
          hideFavorites
        />
      </div>
    </div>
  );
});

ConversationsSection.displayName = 'ConversationsSection';

export default ConversationsSection;
