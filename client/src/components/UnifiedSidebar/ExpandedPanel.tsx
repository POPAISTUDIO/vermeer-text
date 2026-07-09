import { memo, useCallback, lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import { SquarePen } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import { Skeleton, Sidebar, Button, TooltipAnchor } from '@librechat/client';
import type { NavLink } from '~/common';
import { CLOSE_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { useActivePanel, resolveActivePanel, DEFAULT_PANEL } from '~/Providers';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

// Vermeer: rail labellisé (réf. UX Claude.ai) — icône seule quand replié,
// icône + libellé sur la même ligne quand ouvert.
const RAIL_COLLAPSED_WIDTH = 'w-[52px]';
const RAIL_EXPANDED_WIDTH = 'w-[212px]';
const rowBase = 'flex h-9 items-center rounded-lg transition-colors';
const rowLayout = (expanded: boolean) =>
  expanded ? 'w-full justify-start gap-3 px-2' : 'w-9 justify-center';

// Vermeer: en état ouvert, le libellé visible rend le tooltip redondant → on ne
// l'enrobe que quand le rail est replié.
function RailTooltip({
  expanded,
  label,
  children,
}: {
  expanded: boolean;
  label: string;
  children: ReactElement;
}) {
  if (expanded) {
    return children;
  }
  return <TooltipAnchor side="right" description={label} render={children} />;
}

const NewChatButton = memo(function NewChatButton({
  expanded,
  setActive,
}: {
  expanded: boolean;
  setActive: (id: string) => void;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const switchToHistory = useRecoilValue(store.newChatSwitchToHistory);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);
        newConversation();
        if (switchToHistory) {
          setActive(DEFAULT_PANEL);
        }
      }
    },
    [queryClient, conversation?.conversationId, newConversation, switchToHistory, setActive],
  );

  const label = localize('com_ui_new_chat');

  return (
    // Vermeer: libellé inline en état ouvert
    <RailTooltip expanded={expanded} label={label}>
      <a
        href="/c/new"
        data-testid="new-chat-button"
        aria-label={label}
        className={cn(rowBase, rowLayout(expanded), 'text-text-primary hover:bg-surface-hover')}
        onClick={handleClick}
      >
        <SquarePen className="h-5 w-5 flex-shrink-0 text-text-primary" />
        {expanded && <span className="truncate text-sm">{label}</span>}
      </a>
    </RailTooltip>
  );
});

const NavIconButton = memo(function NavIconButton({
  link,
  isActive,
  expanded,
  setActive,
  onExpand,
  onCollapse,
}: {
  link: NavLink;
  isActive: boolean;
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const localize = useLocalize();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (link.onClick) {
        link.onClick(e);
        return;
      }
      if (isActive && expanded) {
        onCollapse?.();
        return;
      }
      if (!isActive) {
        setActive(link.id);
      }
      if (!expanded) {
        onExpand?.();
      }
    },
    [link, isActive, setActive, expanded, onExpand, onCollapse],
  );

  const label = localize(link.title);

  return (
    // Vermeer: libellé inline en état ouvert
    <RailTooltip expanded={expanded} label={label}>
      <Button
        size="icon"
        variant="ghost"
        aria-label={label}
        aria-pressed={isActive}
        className={cn(
          rowBase,
          rowLayout(expanded),
          isActive ? 'bg-surface-active-alt text-text-primary' : 'text-text-secondary',
        )}
        onClick={handleClick}
      >
        <link.icon
          className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-accent')}
          aria-hidden="true"
        />
        {expanded && <span className="truncate text-sm">{label}</span>}
      </Button>
    </RailTooltip>
  );
});

function ExpandedPanel({
  links,
  expanded = true,
  onCollapse,
  onExpand,
}: {
  links: NavLink[];
  expanded?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const effectiveActive = resolveActivePanel(active, links);

  const toggleLabel = expanded ? 'com_nav_close_sidebar' : 'com_nav_open_sidebar';
  const toggleClick = expanded ? onCollapse : onExpand;
  const toggleText = localize(toggleLabel);

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col gap-2 border-r border-border-light bg-surface-primary-alt px-2 py-2',
        // Vermeer: rail élargi à l'ouverture pour loger les libellés
        expanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH,
      )}
    >
      {/* Vermeer: libellé inline en état ouvert */}
      <RailTooltip expanded={expanded} label={toggleText}>
        <Button
          id={expanded ? CLOSE_SIDEBAR_ID : undefined}
          data-testid={expanded ? 'close-sidebar-button' : 'open-sidebar-button'}
          size="icon"
          variant="ghost"
          aria-label={toggleText}
          aria-expanded={expanded}
          className={cn(rowBase, rowLayout(expanded), 'text-text-primary')}
          onClick={toggleClick}
        >
          <Sidebar aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-text-primary" />
          {expanded && <span className="truncate text-sm">{toggleText}</span>}
        </Button>
      </RailTooltip>
      <NewChatButton expanded={expanded} setActive={setActive} />
      <div className="mx-2 border-b border-border-light" />
      <div className="flex flex-col gap-1 overflow-y-auto">
        {links.map((link) => (
          <NavIconButton
            key={link.id}
            link={link}
            isActive={link.id === effectiveActive}
            expanded={expanded ?? true}
            setActive={setActive}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        ))}
      </div>

      <div className="mt-auto">
        <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg" />}>
          {/* Vermeer: variante non-repliée (nom user) quand le rail est ouvert */}
          <AccountSettings collapsed={!expanded} />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ExpandedPanel);
