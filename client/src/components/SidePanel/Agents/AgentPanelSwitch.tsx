import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { AgentPanelProvider, useAgentPanelContext } from '~/Providers/AgentPanelContext';
import { Panel, isEphemeralAgent } from '~/common';
import VersionPanel from './Version/VersionPanel';
import ActionsPanel from './ActionsPanel';
import AgentPanel from './AgentPanel';
import store from '~/store';

// Vermeer: props additives — hideHeader (masque le chrome de nav quand rendu dans la
// modale Vermeer) + agentId (présélection de l'assistant à configurer depuis une carte
// Marketplace, sinon fallback sur l'agent de la conversation courante).
export default function AgentPanelSwitch({
  hideHeader = false,
  agentId,
}: {
  hideHeader?: boolean;
  agentId?: string;
} = {}) {
  return (
    <AgentPanelProvider>
      <AgentPanelSwitchWithContext hideHeader={hideHeader} agentIdOverride={agentId} />
    </AgentPanelProvider>
  );
}

function AgentPanelSwitchWithContext({
  hideHeader = false,
  agentIdOverride,
}: {
  hideHeader?: boolean;
  agentIdOverride?: string;
}) {
  const { activePanel, setCurrentAgentId } = useAgentPanelContext();
  const convoAgentId = useRecoilValue(store.conversationAgentIdByIndex(0));
  // Vermeer: '' = « nouvel assistant » (form vierge, pas de présélection) ; un id non
  // vide présélectionne cet assistant (carte) ; sinon fallback agent de la conversation.
  const isNew = agentIdOverride === '';
  const agentId = isNew ? undefined : (agentIdOverride ?? convoAgentId);

  useEffect(() => {
    if (isNew) {
      return;
    }
    const agent_id = agentId ?? '';
    if (!isEphemeralAgent(agent_id)) {
      setCurrentAgentId(agent_id);
    }
  }, [isNew, setCurrentAgentId, agentId]);

  if (activePanel === Panel.actions) {
    return <ActionsPanel />;
  }
  if (activePanel === Panel.version) {
    return <VersionPanel />;
  }
  return <AgentPanel hideHeader={hideHeader} />;
}
