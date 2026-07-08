import { memo } from 'react';
import { Pin } from 'lucide-react';
import Conversation from '~/components/Conversations/Convo';
import { useGetConvoIdQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';

// Vermeer: groupe « Épinglés » rendu AU-DESSUS des groupes de date dans la liste
// inline. Chaque conv est récupérée par id (cache-first via useGetConvoIdQuery) —
// une conv épinglée peut être hors des pages chargées. Réutilise le composant Convo
// upstream (comportement/menu cohérents), sans le modifier.
const PinnedConvoItem = memo(function PinnedConvoItem({
  conversationId,
  retainView,
  toggleNav,
}: {
  conversationId: string;
  retainView: () => void;
  toggleNav: () => void;
}) {
  const { data: conversation } = useGetConvoIdQuery(conversationId);
  if (!conversation) {
    return null;
  }
  return <Conversation conversation={conversation} retainView={retainView} toggleNav={toggleNav} />;
});

function PinnedGroup({
  pinnedIds,
  retainView,
  toggleNav,
}: {
  pinnedIds: string[];
  retainView: () => void;
  toggleNav: () => void;
}) {
  const localize = useLocalize();

  if (pinnedIds.length === 0) {
    return null;
  }

  return (
    <div className="flex max-h-64 flex-shrink-0 flex-col overflow-y-auto px-2">
      <div className="flex items-center gap-1.5 px-1 py-2 text-xs font-bold text-text-secondary">
        <Pin className="h-3 w-3" aria-hidden="true" />
        <span className="select-none">{localize('com_vermeer_pinned')}</span>
      </div>
      {pinnedIds.map((id) => (
        <PinnedConvoItem
          key={id}
          conversationId={id}
          retainView={retainView}
          toggleNav={toggleNav}
        />
      ))}
    </div>
  );
}

export default memo(PinnedGroup);
