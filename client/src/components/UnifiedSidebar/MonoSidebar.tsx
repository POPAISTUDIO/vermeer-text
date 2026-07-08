import { memo, lazy, Suspense } from 'react';
import { Skeleton } from '@librechat/client';
import type { NavLink } from '~/common';
import { useActivePanel, resolveActivePanel } from '~/Providers';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import SidePanelNav from '~/components/SidePanel/Nav';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { NewChatButton, NavIconButton, SidebarToggleButton } from './buttons';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

// Vermeer: mono-colonne (réf. UI Claude.ai) — nav en haut, liste des conversations
// inline directement dessous. Les sections non migrées ouvrent encore un panneau
// latéral PROVISOIRE (Assistants, Paramètres) via le mécanisme ActivePanel.
const MONO_COLLAPSED_WIDTH = 52;
const MONO_COLUMN_WIDTH = 300;
const MONO_PANEL_WIDTH = 360;
const TRANSITION_MS = 300;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

function MonoSidebar({
  links,
  expanded,
  isSmallScreen = false,
  onCollapse,
  onExpand,
}: {
  links: NavLink[];
  expanded: boolean;
  isSmallScreen?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const effectiveActive = resolveActivePanel(active, links);

  // La liste des conversations vit inline dans la colonne ; elle n'est plus une
  // section de panneau. Les autres entrées restent des rangées de nav.
  const navLinks = links.filter((link) => link.id !== 'conversations');
  const activeLink = links.find((link) => link.id === effectiveActive);
  const panelActive = effectiveActive !== 'conversations' && !!activeLink && !!activeLink.Component;

  const column = (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 bg-surface-primary-alt px-2 py-2">
      <SidebarToggleButton expanded={expanded} onCollapse={onCollapse} onExpand={onExpand} />
      <NewChatButton expanded={expanded} setActive={setActive} />
      <div className="mx-2 border-b border-border-light" />
      <div className="flex flex-col gap-1">
        {navLinks.map((link) => (
          <NavIconButton
            key={link.id}
            link={link}
            isActive={panelActive && link.id === effectiveActive}
            expanded={expanded}
            setActive={setActive}
            onExpand={onExpand}
          />
        ))}
      </div>
      {expanded && (
        <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">
          <ConversationsSection />
        </div>
      )}
      <div className={cn('pt-1', !expanded && 'mt-auto')}>
        <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg" />}>
          <AccountSettings collapsed={!expanded} />
        </Suspense>
      </div>
    </div>
  );

  const provisionalPanel = (widthClass: string) => (
    <nav
      className={cn(
        'min-h-0 overflow-hidden border-l border-border-light bg-surface-primary-alt',
        widthClass,
      )}
      aria-label={localize('com_nav_control_panel')}
    >
      <SidePanelNav links={links} />
    </nav>
  );

  if (isSmallScreen) {
    // Drawer mobile : la colonne remplit le tiroir ; une section active bascule
    // le tiroir sur le panneau provisoire (pas de côte-à-côte sur petit écran).
    return panelActive ? (
      <div className="flex h-full w-full flex-col">{provisionalPanel('w-full flex-1')}</div>
    ) : (
      column
    );
  }

  const columnWidth = expanded ? MONO_COLUMN_WIDTH : MONO_COLLAPSED_WIDTH;
  const asideWidth = columnWidth + (panelActive && expanded ? MONO_PANEL_WIDTH : 0);

  return (
    <aside
      className="relative flex h-full flex-shrink-0 overflow-hidden border-r border-border-light"
      style={{
        width: asideWidth,
        transition: `width ${TRANSITION_MS}ms ${EASING}`,
      }}
      aria-label={localize('com_nav_control_panel')}
    >
      <div className="h-full flex-shrink-0" style={{ width: columnWidth }}>
        {column}
      </div>
      {panelActive && expanded && provisionalPanel('flex-1')}
    </aside>
  );
}

export default memo(MonoSidebar);
