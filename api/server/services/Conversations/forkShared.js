const mongoose = require('mongoose');
const { EModelEndpoint } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const { createImportBatchBuilder } = require('~/server/utils/import/importBatchBuilder');
const { getMessagesUpToTargetLevel, cloneMessagesWithTimestamps } = require('~/server/utils/import/fork');
const { getConvo, getMessages } = require('~/models');

/**
 * Forks (clones) a conversation shared by ANOTHER user into a NEW conversation owned
 * by the requesting user. Mirrors the whole-conversation body of the native
 * `duplicateConversation`, but:
 *  - reads the SOURCE cross-user (no `{ user }` filter), and
 *  - binds the import batch builder to the forker so the copy belongs to them.
 *
 * Reuses the native clone primitives (createImportBatchBuilder, getMessagesUpToTargetLevel,
 * cloneMessagesWithTimestamps) without modifying them.
 *
 * SECURITY: the caller MUST enforce gating (agent VIEW + agent_id match + isShared)
 * BEFORE calling this. This function performs no authorization on its own.
 *
 * @param {{ requestUserId: string, sourceConversationId: string }} params
 * @returns {Promise<TConversation>} the new conversation owned by requestUserId
 */
async function forkSharedConversation({ requestUserId, sourceConversationId }) {
  const Conversation = mongoose.models.Conversation;
  const sourceConvo = await Conversation.findOne({ conversationId: sourceConversationId }).lean();
  if (!sourceConvo) {
    throw new Error('Conversation not found');
  }

  const sourceMessages = await getMessages({ conversationId: sourceConversationId });
  if (!sourceMessages.length) {
    throw new Error('No messages to fork');
  }

  const messagesToClone = getMessagesUpToTargetLevel(
    sourceMessages,
    sourceMessages[sourceMessages.length - 1].messageId,
  );

  const importBatchBuilder = createImportBatchBuilder(requestUserId);
  importBatchBuilder.startConversation(sourceConvo.endpoint ?? EModelEndpoint.openAI);

  cloneMessagesWithTimestamps(messagesToClone, importBatchBuilder);

  // Strip the share flag so the forked copy is PRIVATE by default. finishConversation
  // spreads `...originalConvo` and only overrides `user`, so without this the copy would
  // inherit isSharedWithAgentMembers: true from the source.
  const { isSharedWithAgentMembers, ...sourceForClone } = sourceConvo;
  void isSharedWithAgentMembers;

  const result = importBatchBuilder.finishConversation(
    sourceConvo.title,
    new Date(),
    sourceForClone,
  );
  await importBatchBuilder.saveBatch();
  logger.debug(
    `user: ${requestUserId} | New conversation "${sourceConvo.title}" forked from shared conversation ID ${sourceConversationId}`,
  );

  return getConvo(requestUserId, result.conversation.conversationId);
}

module.exports = { forkSharedConversation };
