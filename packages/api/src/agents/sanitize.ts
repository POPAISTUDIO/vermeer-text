import { Constants } from '@librechat/agents';
import { ContentTypes } from 'librechat-data-provider';
import { isAIMessage } from '@librechat/agents/langchain/messages';
import type { TMessageContentParts, TFile } from 'librechat-data-provider';
import type { BaseMessage } from '@librechat/agents/langchain/messages';

/**
 * Minimal shape of a message as produced by `formatMessage` just before
 * `formatAgentMessages` runs: `content` may still be a raw string (plain text
 * message) or an array of content parts (media already merged in).
 */
type SanitizableMessage = {
  content?: string | TMessageContentParts[];
  files?: Partial<TFile>[];
  image_urls?: TMessageContentParts[];
};

const isEmptyTextPart = (part: TMessageContentParts): boolean => {
  if (part == null || part.type !== ContentTypes.TEXT) {
    return false;
  }
  return String(part.text ?? '').trim().length === 0;
};

const hasNonTextMedia = (message: SanitizableMessage): boolean =>
  (Array.isArray(message.files) && message.files.length > 0) ||
  (Array.isArray(message.image_urls) && message.image_urls.length > 0);

/**
 * Vermeer — defends against Anthropic 400 "text content blocks must contain
 * non-whitespace text". Anthropic strictly rejects any empty/whitespace-only
 * text content block; a single empty user message persisted in history poisons
 * every subsequent request in the conversation. Upstream `formatAgentMessages`
 * only filters empty text blocks for ASSISTANT messages, never for user ones,
 * and `formatMediaMessage` always appends a `{ type: 'text', text }` block to
 * media messages — so an image-only message (text === '') yields an empty text
 * block too.
 *
 * Strips empty/whitespace-only text blocks before `formatAgentMessages` while
 * preserving every legitimate case:
 * - non-empty string content -> unchanged
 * - empty/whitespace string WITH media (files/image_urls) -> unchanged
 * - empty/whitespace string WITHOUT media -> content becomes `[]`, which
 *   `formatAgentMessages` skips natively (its empty-array guard), so no message
 *   is removed here and array indices stay aligned with `indexTokenCountMap`
 * - array content -> only empty text parts removed; images, tool calls and any
 *   other block are kept (an image-only message keeps its image, loses the
 *   empty text block)
 *
 * Never changes the length of the `messages` array (index alignment is relied
 * upon by the caller's `indexTokenCountMap`). Provider-agnostic: an empty text
 * block is never useful anywhere, so this is applied unconditionally.
 */
export function stripEmptyTextBlocks<T extends SanitizableMessage>(messages: T[]): T[] {
  return messages.map((message): T => {
    const { content } = message;

    if (typeof content === 'string') {
      if (content.trim().length === 0 && !hasNonTextMedia(message)) {
        return { ...message, content: [] };
      }
      return message;
    }

    if (!Array.isArray(content)) {
      return message;
    }

    return { ...message, content: content.filter((part) => !isEmptyTextPart(part)) };
  });
}

/**
 * Vermeer — repairs the Anthropic 400 "text content blocks must contain
 * non-whitespace text" triggered by an assistant turn that used a native
 * server tool (e.g. web search, whose tool-call id is prefixed `srvtoolu_`).
 *
 * After `formatAgentMessages`, such a turn is reconstructed as an `AIMessage`
 * with an empty-string `content` plus `tool_calls` that are all server tools.
 * When `@librechat/agents` converts that message to the Anthropic payload
 * (`message_inputs.cjs` `_convertMessagesToAnthropicPayload`), the empty
 * `content` is replaced by `[{ type: 'text', text: ' ' }]` — a whitespace-only
 * block the API rejects, poisoning every subsequent request in the conversation.
 * This fires downstream of `stripEmptyTextBlocks` (the offending block does not
 * exist yet at that stage), so a separate, later pass is required.
 *
 * Fills the empty content with a minimal non-whitespace placeholder so the
 * conversion emits a valid text block instead. Strictly scoped: only AIMessages
 * whose `content` is an empty/whitespace string AND whose `tool_calls` are ALL
 * server tools are touched. Mutates `content` in place to preserve the
 * `AIMessage` prototype (`tool_calls`, `additional_kwargs`, `_getType`, …);
 * never removes, reorders, or alters tool_calls, so the following tool result is
 * never orphaned and array indices stay aligned with `indexTokenCountMap`.
 */
export function sanitizeServerToolMessages(messages: BaseMessage[]): BaseMessage[] {
  for (const message of messages) {
    if (!isAIMessage(message)) {
      continue;
    }
    if (typeof message.content !== 'string' || message.content.trim().length > 0) {
      continue;
    }
    const toolCalls = message.tool_calls;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      continue;
    }
    const allServerTools = toolCalls.every(
      (toolCall) =>
        typeof toolCall.id === 'string' &&
        toolCall.id.startsWith(Constants.ANTHROPIC_SERVER_TOOL_PREFIX),
    );
    if (!allServerTools) {
      continue;
    }
    message.content = '.';
  }
  return messages;
}
