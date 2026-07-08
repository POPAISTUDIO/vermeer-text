import { memo, lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { EModelEndpoint } from 'librechat-data-provider';
import { Skeleton } from '@librechat/client';
import type { NavLink } from '~/common';
import { useActivePanel, resolveActivePanel, DEFAULT_PANEL } from '~/Providers';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import SectionModal from '~/components/UnifiedSidebar/SectionModal';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import { NewChatButton, NavIconButton, SidebarToggleButton } from './buttons';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));
// Vermeer: builder Assistants ouvert en modale dédiée (pont depuis la page /assistants)
const AgentPanelSwitch = lazy(() => import('~/components/SidePanel/Agents/AgentPanelSwitch'));

// Vermeer: mono-colonne (réf. UI Claude.ai) — nav en haut, liste des conversations
// inline directement dessous. PLUS AUCUN panneau latéral : toute section à Component
// (Assistants, Skills, Paramètres, Fichiers, Mémoires) s'ouvre en MODALE générique,
// pilotée par ActivePanel. Usage/conversations ont un onClick (route)/rendu inline.
// Les modales sont montées sous SidebarChatProvider (via UnifiedSidebar), donc les
// composants couplés à ChatContext (Parameters, PanelTable, builder Assistants)
// disposent du contexte — pas de crash comme en page pleine hors providers.
const MONO_COLLAPSED_WIDTH = 52;
const MONO_COLUMN_WIDTH = 300;
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
  const navigate = useNavigate();
  const { active, setActive } = useActivePanel();
  const [builderOpen, setBuilderOpen] = useRecoilState(store.openBuilderModal);
  const effectiveActive = resolveActivePanel(active, links);

  // Rangées de nav = tout sauf conversations (inline) et Signets (retirés). Assistants
  // → page /assistants (le builder s'ouvre en modale depuis cette page via le pont Recoil).
  const navLinks = useMemo(
    () =>
      links
        .filter((link) => link.id !== 'conversations' && link.id !== 'bookmarks')
        .map((link) =>
          link.id === EModelEndpoint.agents
            ? { ...link, onClick: () => navigate('/assistants') }
            : link,
        ),
    [links, navigate],
  );

  // Une section « ouvre une modale » ssi elle a un Component et pas d'onClick (route).
  const activeNav = navLinks.find((link) => link.id === effectiveActive);
  const modalActive = !!activeNav && !activeNav.onClick && !!activeNav.Component;
  const ActiveComponent = modalActive ? activeNav?.Component : undefined;

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setActive(DEFAULT_PANEL);
    }
  };

  // Modale de section générique (Skills, Paramètres, Fichiers, Mémoires) — large.
  const sectionModal = (
    <SectionModal
      open={modalActive}
      onOpenChange={handleModalOpenChange}
      title={activeNav ? localize(activeNav.title) : ''}
    >
      {ActiveComponent ? <ActiveComponent /> : null}
    </SectionModal>
  );

  // Vermeer: modale builder Assistants dédiée, ouverte par le pont depuis les cartes
  // Marketplace (openBuilderModal = agentId à configurer). Montée ici (sous
  // SidebarChatProvider) → AgentPanelSwitch a bien ChatContext. hideHeader masque le
  // chrome de navigation redondant ; agentId présélectionne l'assistant de la carte.
  const builderModal = (
    <SectionModal
      open={builderOpen != null}
      onOpenChange={(open) => {
        if (!open) {
          setBuilderOpen(null);
        }
      }}
      title={localize('com_vermeer_configure')}
    >
      {builderOpen != null ? (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          }
        >
          <AgentPanelSwitch hideHeader agentId={builderOpen} />
        </Suspense>
      ) : null}
    </SectionModal>
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
            isActive={modalActive && link.id === effectiveActive}
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

  if (isSmallScreen) {
    // Drawer mobile : la colonne remplit le tiroir ; les sections s'ouvrent en modale par-dessus.
    return (
      <>
        {column}
        {sectionModal}
        {builderModal}
      </>
    );
  }

  const columnWidth = expanded ? MONO_COLUMN_WIDTH : MONO_COLLAPSED_WIDTH;

  return (
    <>
      <aside
        className="relative flex h-full flex-shrink-0 overflow-hidden border-r border-border-light"
        style={{ width: columnWidth, transition: `width ${TRANSITION_MS}ms ${EASING}` }}
        aria-label={localize('com_nav_control_panel')}
      >
        <div className="h-full w-full">{column}</div>
      </aside>
      {sectionModal}
      {builderModal}
    </>
  );
}

export default memo(MonoSidebar);
