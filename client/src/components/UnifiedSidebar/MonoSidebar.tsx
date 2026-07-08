import { memo, lazy, Suspense, useState, useMemo } from 'react';
import { Skeleton } from '@librechat/client';
import type { NavLink } from '~/common';
import { useActivePanel, resolveActivePanel } from '~/Providers';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import SectionModal from '~/components/UnifiedSidebar/SectionModal';
import { MemoryPanel } from '~/components/SidePanel/Memories';
import FilesPanel from '~/components/SidePanel/Files/Panel';
import SidePanelNav from '~/components/SidePanel/Nav';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { NewChatButton, NavIconButton, SidebarToggleButton } from './buttons';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

// Vermeer: mono-colonne (réf. UI Claude.ai) — nav en haut, liste des conversations
// inline directement dessous. Sections migrées : Usage → route, Fichiers/Mémoires
// → modale, Signets retiré. Assistants, Skills + Paramètres gardent un panneau
// latéral PROVISOIRE via le mécanisme ActivePanel.
const MONO_COLLAPSED_WIDTH = 52;
const MONO_COLUMN_WIDTH = 300;
// Vermeer: panneau provisoire élargi (560) — la config du builder Assistants était coupée à 360.
const MONO_PANEL_WIDTH = 560;
const TRANSITION_MS = 300;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

type ModalSection = null | 'files' | 'memories';

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
  const [modal, setModal] = useState<ModalSection>(null);
  const effectiveActive = resolveActivePanel(active, links);

  // La liste des conversations vit inline dans la colonne (retirée des rangées de
  // nav), et les Signets sont retirés du rail. Fichiers/Mémoires ouvrent une
  // modale ; les autres (Assistants, Skills, Paramètres) gardent le panneau
  // latéral via setActive.
  const navLinks = useMemo(
    () =>
      links
        .filter((link) => link.id !== 'conversations' && link.id !== 'bookmarks')
        .map((link) => {
          if (link.id === 'files') {
            return { ...link, onClick: () => setModal('files') };
          }
          if (link.id === 'memories') {
            return { ...link, onClick: () => setModal('memories') };
          }
          return link;
        }),
    [links],
  );

  // Seules les sections qui utilisent encore setActive (Component sans onClick)
  // ouvrent le panneau provisoire.
  const activeNav = navLinks.find((link) => link.id === effectiveActive);
  const panelActive = !!activeNav && !activeNav.onClick && !!activeNav.Component;

  const closeModal = (open: boolean) => {
    if (!open) {
      setModal(null);
    }
  };

  const modals = (
    <>
      <SectionModal
        open={modal === 'files'}
        onOpenChange={closeModal}
        title={localize('com_vermeer_nav_file_history')}
      >
        <FilesPanel />
      </SectionModal>
      <SectionModal
        open={modal === 'memories'}
        onOpenChange={closeModal}
        title={localize('com_ui_memories')}
      >
        <MemoryPanel />
      </SectionModal>
    </>
  );

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
    return (
      <>
        {panelActive ? (
          <div className="flex h-full w-full flex-col">{provisionalPanel('w-full flex-1')}</div>
        ) : (
          column
        )}
        {modals}
      </>
    );
  }

  const columnWidth = expanded ? MONO_COLUMN_WIDTH : MONO_COLLAPSED_WIDTH;
  const asideWidth = columnWidth + (panelActive && expanded ? MONO_PANEL_WIDTH : 0);

  return (
    <>
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
      {modals}
    </>
  );
}

export default memo(MonoSidebar);
