import { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Trans } from 'react-i18next';
import {
  Input,
  Label,
  Button,
  Spinner,
  TrashIcon,
  OGDialog,
  TooltipAnchor,
  OGDialogTrigger,
  OGDialogTemplate,
  useToastContext,
} from '@librechat/client';
import type { AgentSharedMemory as TSharedMemory } from 'librechat-data-provider';
import { useGetExpandedAgentByIdQuery, useUpdateAgentMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const formatDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

interface SharedMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TSharedMemory | null;
  isSaving: boolean;
  onSubmit: (key: string, value: string) => void;
  children?: React.ReactNode;
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

function SharedMemoryDialog({
  open,
  onOpenChange,
  initial,
  isSaving,
  onSubmit,
  children,
  triggerRef,
}: SharedMemoryDialogProps) {
  const localize = useLocalize();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setKey(initial?.key ?? '');
      setValue(initial?.value ?? '');
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!key.trim() || !value.trim()) {
      return;
    }
    onSubmit(key.trim(), value.trim());
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        title={localize(initial ? 'com_ui_edit_memory' : 'com_ui_create_memory')}
        showCloseButton={false}
        className="w-11/12 md:max-w-lg"
        main={
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shared-memory-key" className="text-sm font-medium text-text-primary">
                {localize('com_ui_key')}
              </Label>
              <Input
                id="shared-memory-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={localize('com_ui_enter_key')}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="shared-memory-value"
                className="text-sm font-medium text-text-primary"
              >
                {localize('com_ui_value')}
              </Label>
              <textarea
                id="shared-memory-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={localize('com_ui_enter_value')}
                className="min-h-[100px] w-full resize-none rounded-lg border border-border-light bg-transparent px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-heavy"
                rows={4}
              />
            </div>
          </div>
        }
        buttons={
          <Button
            type="button"
            variant="submit"
            onClick={handleSave}
            aria-label={localize('com_ui_save')}
            disabled={isSaving || !key.trim() || !value.trim()}
            className="text-white"
          >
            {isSaving ? <Spinner className="size-4" /> : localize('com_ui_save')}
          </Button>
        }
      />
    </OGDialog>
  );
}

interface AgentSharedMemoryProps {
  agentId: string;
  canEdit: boolean;
}

/**
 * Mémoire-assistant partagée (Approche B) — groupe « Mémoire de l'assistant (partagée) ».
 * Lit `agent.shared_memory` (portée par la définition de l'agent, renvoyée via l'endpoint
 * expanded gaté EDIT) et la persiste via PATCH /agents/:id — JAMAIS via /api/memories.
 * Édition réservée aux utilisateurs avec EDIT sur l'agent ; sinon lecture seule.
 */
export default function AgentSharedMemory({ agentId, canEdit }: AgentSharedMemoryProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  /** L'endpoint expanded est gaté EDIT côté serveur ; AgentMemory n'est monté que dans
   *  AgentConfig (lui-même gaté `canEditAgent`), donc la lecture réussit toujours ici.
   *  On affiche la mémoire partagée dès que l'assistant est enregistré ; seules les
   *  actions d'écriture sont gatées par `canEdit`. */
  const { data: agent, isLoading } = useGetExpandedAgentByIdQuery(agentId, {
    enabled: !!agentId,
  });
  const entries = useMemo<TSharedMemory[]>(() => agent?.shared_memory ?? [], [agent]);

  const { mutate: updateAgent, isLoading: isSaving } = useUpdateAgentMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TSharedMemory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TSharedMemory | null>(null);

  const persist = (next: TSharedMemory[], onDone?: () => void) => {
    updateAgent(
      { agent_id: agentId, data: { shared_memory: next } },
      {
        onSuccess: () => {
          showToast({ message: localize('com_ui_saved'), status: 'success' });
          onDone?.();
        },
        onError: () => {
          showToast({ message: localize('com_ui_error'), status: 'error' });
        },
      },
    );
  };

  const handleSubmit = (key: string, value: string) => {
    const now = new Date().toISOString();
    const editingKey = editing?.key ?? null;
    const exists = entries.some((e) => e.key === editingKey);
    const next: TSharedMemory[] = exists
      ? entries.map((e) => (e.key === editingKey ? { key, value, updated_at: now } : e))
      : [...entries, { key, value, updated_at: now }];
    persist(next, () => {
      setDialogOpen(false);
      setEditing(null);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    const next = entries.filter((e) => e.key !== deleteTarget.key);
    persist(next, () => setDeleteTarget(null));
  };

  const buttonBaseClass = cn(
    'flex size-7 items-center justify-center rounded-md',
    'transition-colors duration-150',
    'text-text-secondary hover:text-text-primary',
    'hover:bg-surface-tertiary',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {localize('com_assistants_memory_shared_section')}
        </p>
        {canEdit && (
          <SharedMemoryDialog
            open={dialogOpen && editing == null}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditing(null);
              }
            }}
            initial={null}
            isSaving={isSaving}
            onSubmit={handleSubmit}
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
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </OGDialogTrigger>
          </SharedMemoryDialog>
        )}
      </div>
      <p className="text-xs text-text-secondary">{localize('com_assistants_memory_shared_hint')}</p>

      {isLoading && (
        <div className="flex w-full items-center justify-center p-4">
          <Spinner />
        </div>
      )}
      {!isLoading && entries.length === 0 && (
        <p className="px-1 py-2 text-sm text-text-secondary">
          {localize('com_assistants_memory_shared_empty')}
        </p>
      )}
      {!isLoading && entries.length > 0 && (
        <div role="list" className="space-y-2">
          {entries.map((entry) => (
            <div
              key={`shared:${entry.key}`}
              role="listitem"
              className={cn(
                'rounded-lg px-3 py-2.5',
                'border border-border-light bg-transparent',
                'hover:bg-surface-secondary',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {entry.key}
                </span>
                <span className="shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-primary">
                  {localize('com_assistants_memory_badge_shared')}
                </span>
                {canEdit && (
                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className={buttonBaseClass}
                      aria-label={localize('com_ui_edit')}
                      onClick={() => {
                        setEditing(entry);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={buttonBaseClass}
                      aria-label={localize('com_ui_delete')}
                      onClick={() => setDeleteTarget(entry)}
                    >
                      <TrashIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <p
                  className="min-w-0 flex-1 truncate text-sm text-text-primary"
                  title={entry.value}
                >
                  {entry.value}
                </p>
                {entry.updated_at && (
                  <span className="shrink-0 text-xs text-text-secondary">
                    {formatDate(entry.updated_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <SharedMemoryDialog
          open={dialogOpen && editing != null}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditing(null);
            }
          }}
          initial={editing}
          isSaving={isSaving}
          onSubmit={handleSubmit}
        />
      )}

      <OGDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <OGDialogTemplate
          showCloseButton={false}
          title={localize('com_ui_delete_memory')}
          className="w-11/12 max-w-lg"
          main={
            <Label className="text-left text-sm font-medium">
              <Trans
                i18nKey="com_ui_delete_confirm_strong"
                values={{ title: deleteTarget?.key ?? '' }}
                components={{ strong: <strong /> }}
              />
            </Label>
          }
          selection={{
            selectHandler: confirmDelete,
            selectClasses:
              'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 text-white',
            selectText: localize('com_ui_delete'),
          }}
        />
      </OGDialog>
    </div>
  );
}
