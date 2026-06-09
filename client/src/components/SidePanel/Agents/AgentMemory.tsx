import { useMemo, useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useWatch, useFormContext } from 'react-hook-form';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import {
  Button,
  Spinner,
  Accordion,
  TooltipAnchor,
  AccordionItem,
  OGDialogTrigger,
  AccordionTrigger,
  AccordionContent,
} from '@librechat/client';
import type { TUserMemory } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import MemoryCreateDialog from '~/components/SidePanel/Memories/MemoryCreateDialog';
import MemoryCardActions from '~/components/SidePanel/Memories/MemoryCardActions';
import AgentSharedMemory from '~/components/SidePanel/Agents/AgentSharedMemory';
import { useMemoriesQuery } from '~/data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { cn } from '~/utils';

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/**
 * Section « Mémoire » du builder — 3 catégories en 2 groupes.
 *  - Groupe « partagée » : `agent.shared_memory` (Approche B), badge « Assistant (partagée) »,
 *    éditée via PATCH /agents/:id (cf. {@link AgentSharedMemory}). Distincte des mémoires perso.
 *  - Groupe « perso » : vue union (global ∪ assistant courant) scopée par l'agentId, via
 *    /api/memories. Badges « Cet assistant » (éditable) / « Global » (lecture seule ici, géré
 *    dans le panneau Mémoires de la sidebar).
 */
export default function AgentMemory() {
  const localize = useLocalize();
  const { control } = useFormContext<AgentForm>();
  const agentId = useWatch({ control, name: 'id' });
  const [createOpen, setCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  const hasReadAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ,
  });
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE,
  });
  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE,
  });

  const isSaved = typeof agentId === 'string' && agentId.trim() !== '';

  const { data, isLoading } = useMemoriesQuery(isSaved ? agentId : undefined, {
    enabled: isSaved && hasReadAccess,
  });

  const memories: TUserMemory[] = useMemo(() => data?.memories ?? [], [data]);

  if (!hasReadAccess) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className="mb-4 w-full">
      <AccordionItem value="agent-memory" className="border-b-0">
        <AccordionTrigger className="text-sm font-medium text-text-primary hover:no-underline">
          {localize('com_assistants_memory_title')}
        </AccordionTrigger>
        <AccordionContent>
          {!isSaved ? (
            <p className="px-1 py-2 text-sm text-text-secondary">
              {localize('com_assistants_memory_save_first')}
            </p>
          ) : isLoading ? (
            <div className="flex w-full items-center justify-center p-4">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <AgentSharedMemory agentId={agentId} canEdit={hasUpdateAccess} />

              <div className="h-px bg-border-light" />

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {localize('com_assistants_memory_personal_section')}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    {localize('com_assistants_memory_description')}
                  </p>
                  {hasCreateAccess && (
                    <MemoryCreateDialog
                      open={createOpen}
                      onOpenChange={setCreateOpen}
                      agentId={agentId}
                      triggerRef={createTriggerRef}
                    >
                      <OGDialogTrigger asChild>
                        <TooltipAnchor
                          description={localize('com_ui_create_memory')}
                          side="bottom"
                          render={
                            <Button
                              ref={createTriggerRef}
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0 bg-transparent"
                              aria-label={localize('com_ui_create_memory')}
                              onClick={() => setCreateOpen(true)}
                            >
                              <Plus className="size-4" aria-hidden="true" />
                            </Button>
                          }
                        />
                      </OGDialogTrigger>
                    </MemoryCreateDialog>
                  )}
                </div>

                {memories.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-text-secondary">
                    {localize('com_assistants_memory_empty')}
                  </p>
                ) : (
                  <div role="list" className="space-y-2">
                    {memories.map((memory) => {
                      const isOwn = (memory.agentId ?? null) === agentId;
                      return (
                        <div
                          key={`${memory.agentId ?? 'global'}:${memory.key}`}
                          role="listitem"
                          className={cn(
                            'rounded-lg px-3 py-2.5',
                            'border border-border-light bg-transparent',
                            'hover:bg-surface-secondary',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-text-primary">
                              {memory.key}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                                isOwn
                                  ? 'bg-surface-tertiary text-text-primary'
                                  : 'bg-transparent text-text-secondary ring-1 ring-border-light',
                              )}
                            >
                              {localize(
                                isOwn
                                  ? 'com_assistants_memory_badge_self'
                                  : 'com_assistants_memory_badge_global',
                              )}
                            </span>
                            {isOwn && hasUpdateAccess && (
                              <div className="ml-auto shrink-0">
                                <MemoryCardActions memory={memory} />
                              </div>
                            )}
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <p
                              className="min-w-0 flex-1 truncate text-sm text-text-primary"
                              title={memory.value}
                            >
                              {memory.value}
                            </p>
                            <span className="shrink-0 text-xs text-text-secondary">
                              {formatDate(memory.updated_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
