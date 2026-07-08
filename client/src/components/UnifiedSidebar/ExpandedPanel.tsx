import { memo, lazy, Suspense } from 'react';
import { Skeleton } from '@librechat/client';
import type { NavLink } from '~/common';
import { useActivePanel, resolveActivePanel } from '~/Providers';
import { cn } from '~/utils';
import { NewChatButton, NavIconButton, SidebarToggleButton } from './buttons';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

// Vermeer: rail labellisé (réf. UX Claude.ai) — icône seule quand replié,
// icône + libellé sur la même ligne quand ouvert.
const RAIL_COLLAPSED_WIDTH = 'w-[52px]';
const RAIL_EXPANDED_WIDTH = 'w-[212px]';

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
  const { active, setActive } = useActivePanel();
  const effectiveActive = resolveActivePanel(active, links);

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col gap-2 border-r border-border-light bg-surface-primary-alt px-2 py-2',
        // Vermeer: rail élargi à l'ouverture pour loger les libellés
        expanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH,
      )}
    >
      <SidebarToggleButton expanded={expanded} onCollapse={onCollapse} onExpand={onExpand} />
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
