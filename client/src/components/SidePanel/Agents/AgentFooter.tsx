import { useSetRecoilState } from 'recoil';
import { Globe, MessagesSquare } from 'lucide-react';
import { Spinner } from '@librechat/client';
import { useNavigate } from 'react-router-dom';
import { useWatch, useFormContext } from 'react-hook-form';
import {
  SystemRoles,
  Permissions,
  ResourceType,
  PermissionBits,
  PermissionTypes,
} from 'librechat-data-provider';
import type { AgentForm, AgentPanelProps } from '~/common';
import { useLocalize, useAuthContext, useHasAccess, useResourcePermissions } from '~/hooks';
import { isEphemeralAgent } from '~/common';
import { GenericGrantAccessDialog } from '~/components/Sharing';
import { useUpdateAgentMutation } from '~/data-provider';
import AdvancedButton from './Advanced/AdvancedButton';
import VersionButton from './Version/VersionButton';
import DuplicateAgent from './DuplicateAgent';
import DeleteButton from './DeleteButton';
import { Panel } from '~/common';
import store from '~/store';

// Vermeer: masquage des « Réglages avancés » du builder (wagon B v0.10.21) —
// pendant du flag homonyme dans AgentConfig.tsx. Gate le bouton
// « Réglages avancés » (AdvancedButton) qui est le SEUL point d'entrée vers
// l'AdvancedPanel (Panel.advanced : chaînage d'agents / sous-agents / handoffs /
// MaxAgentSteps) : masquer le bouton rend le panneau inatteignable. Masquage UI
// seul, les valeurs (subagents/edges/agent_ids/maxAgentSteps) restent en base et
// au runtime. Réversible en passant a `true`.
const SHOW_ADVANCED_SETTINGS = false;

export default function AgentFooter({
  activePanel,
  createMutation,
  updateMutation,
  setActivePanel,
  setCurrentAgentId,
  isAvatarUploading = false,
}: Pick<
  AgentPanelProps,
  'setCurrentAgentId' | 'createMutation' | 'activePanel' | 'setActivePanel'
> & {
  updateMutation: ReturnType<typeof useUpdateAgentMutation>;
  isAvatarUploading?: boolean;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const setOpenBuilder = useSetRecoilState(store.openBuilderModal);

  const methods = useFormContext<AgentForm>();

  const { control } = methods;
  const agent = useWatch({ control, name: 'agent' });
  const agent_id = useWatch({ control, name: 'id' });
  const hasAccessToShareAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.SHARE,
  });
  const hasAccessToShareRemoteAgents = useHasAccess({
    permissionType: PermissionTypes.REMOTE_AGENTS,
    permission: Permissions.SHARE,
  });
  const { hasPermission, isLoading: permissionsLoading } = useResourcePermissions(
    ResourceType.AGENT,
    agent?._id || '',
  );
  const { hasPermission: hasRemoteAgentPermission, isLoading: remotePermissionsLoading } =
    useResourcePermissions(ResourceType.REMOTE_AGENT, agent?._id || '');

  const canShareThisAgent = hasPermission(PermissionBits.SHARE);
  const canEditThisAgent = hasPermission(PermissionBits.EDIT);
  const canDeleteThisAgent = hasPermission(PermissionBits.DELETE);
  const canShareRemoteAgent = hasRemoteAgentPermission(PermissionBits.SHARE);
  const isSaving = createMutation.isLoading || updateMutation.isLoading || isAvatarUploading;
  const renderSaveButton = () => {
    if (isSaving) {
      return <Spinner className="icon-md" aria-hidden="true" />;
    }

    if (agent_id) {
      return localize('com_ui_save');
    }

    return localize('com_ui_create');
  };

  const showButtons = activePanel === Panel.builder;

  return (
    <div className="mb-1 flex w-full flex-col gap-2">
      {SHOW_ADVANCED_SETTINGS && showButtons && <AdvancedButton setActivePanel={setActivePanel} />}
      {showButtons && agent_id && <VersionButton setActivePanel={setActivePanel} />}
      {/* Context Button */}
      <div className="flex items-center justify-end gap-2">
        {(agent?.author === user?.id || user?.role === SystemRoles.ADMIN || canDeleteThisAgent) &&
          !permissionsLoading && (
            <DeleteButton
              agent_id={agent_id}
              setCurrentAgentId={setCurrentAgentId}
              createMutation={createMutation}
            />
          )}
        {(agent?.author === user?.id || user?.role === SystemRoles.ADMIN || canShareThisAgent) &&
          hasAccessToShareAgents &&
          !permissionsLoading && (
            <GenericGrantAccessDialog
              resourceDbId={agent?._id}
              resourceId={agent_id}
              resourceName={agent?.name ?? ''}
              resourceType={ResourceType.AGENT}
            />
          )}
        {(agent?.author === user?.id || user?.role === SystemRoles.ADMIN || canShareRemoteAgent) &&
          hasAccessToShareRemoteAgents &&
          !remotePermissionsLoading &&
          agent?._id && (
            <GenericGrantAccessDialog
              resourceDbId={agent?._id}
              resourceId={agent_id}
              resourceName={agent?.name ?? ''}
              resourceType={ResourceType.REMOTE_AGENT}
            >
              <button
                type="button"
                className="btn btn-neutral border-token-border-light h-9 px-3"
                title={localize('com_ui_remote_access')}
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
              </button>
            </GenericGrantAccessDialog>
          )}
        {!!agent_id && !isEphemeralAgent(agent_id) && (
          <button
            type="button"
            onClick={() => {
              // Vermeer: fermer la modale builder AVANT de naviguer vers la vue
              // partagée (route pleine page), sinon la SectionModal (nonModal)
              // reste montée et recouvre la vue — mêmes symptôme et parade que le
              // chemin logo (AgentDetailContent → onRequestClose puis navigate).
              // Fermeture INCONDITIONNELLE (pas de gate hideHeader) : c'est un
              // no-op quand openBuilderModal est déjà null (side-panel upstream),
              // et il n'y a aucun comportement upstream à protéger ici (contrairement
              // au #49 où la fermeture touchait l'édition continue du side-panel).
              setOpenBuilder(null);
              navigate(`/agents/${agent_id}/shared-conversations`);
            }}
            className="btn btn-neutral border-token-border-light h-9 px-3"
            title={localize('com_ui_shared_conversations')}
            aria-label={localize('com_ui_shared_conversations')}
          >
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {(agent?.author === user?.id || user?.role === SystemRoles.ADMIN || canEditThisAgent) &&
          !permissionsLoading && <DuplicateAgent agent_id={agent_id} />}
        {/* Submit Button */}
        <button
          className="btn btn-primary focus:shadow-outline flex h-9 w-full items-center justify-center px-4 py-2 font-semibold text-white hover:bg-green-600 focus:border-green-500"
          type="submit"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {renderSaveButton()}
        </button>
      </div>
    </div>
  );
}
