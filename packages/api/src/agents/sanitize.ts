import { Constants } from '@librechat/agents';
import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts, TFile } from 'librechat-data-provider';

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

/** Minimal shape of a payload message as seen just before `formatAgentMessages`:
 * a `role` and a `content` that is either a raw string or content parts. */
type ServerToolStrippableMessage = {
  role?: string;
  content?: string | TMessageContentParts[];
};

const isServerToolCallPart = (part: TMessageContentParts): boolean => {
  if (part == null || part.type !== ContentTypes.TOOL_CALL) {
    return false;
  }
  const id = part.tool_call?.id;
  return typeof id === 'string' && id.startsWith(Constants.ANTHROPIC_SERVER_TOOL_PREFIX);
};

/**
 * Vermeer — repairs the Anthropic 400 "messages.N: user messages must have
 * non-empty content" triggered by replaying a native server tool (e.g. web
 * search, whose tool-call id is prefixed `srvtoolu_`).
 *
 * A server tool is executed provider-side and its result lives inside the
 * assistant message (as a `web_search_tool_result` block), never as a separate
 * client `tool_result`. LibreChat persists that turn with a `tool_call` content
 * part, so on replay `formatAgentMessages`/`formatAssistantMessage` reconstructs
 * it as the client-tool pattern: an `AIMessage` + an orphan `ToolMessage`. The
 * Anthropic conversion (`message_inputs` `_convertMessagesToAnthropicPayload`)
 * then turns that `ToolMessage` into a `role: user` message whose `tool_result`
 * block carries the `srvtoolu_` id with string content — which `_formatContent`
 * drops as invalid, leaving the user message with empty content and poisoning
 * every subsequent request in the conversation.
 *
 * Run BEFORE `formatAgentMessages` (operates on the raw `TMessage[]` payload):
 * removes the server-tool `tool_call` content parts from assistant messages so
 * the orphan `ToolMessage` is never created and the turn keeps only its answer
 * text (and any client-tool calls). Strictly scoped: only assistant messages
 * with array content are touched, and only parts whose `tool_call.id` starts
 * with the server-tool prefix are removed — client tool calls (`toolu_`/`call_`
 * ids), text, citations, images and reasoning are preserved. Immutable: a
 * message is only reconstructed when a part was actually removed. An assistant
 * message reduced to `content: []` is left as-is; `formatAgentMessages` skips
 * empty-array messages natively and keeps `indexTokenCountMap` aligned.
 */
export function stripServerToolParts<T extends ServerToolStrippableMessage>(messages: T[]): T[] {
  return messages.map((message): T => {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      return message;
    }
    const filtered = message.content.filter((part) => !isServerToolCallPart(part));
    if (filtered.length === message.content.length) {
      return message;
    }
    return { ...message, content: filtered };
  });
}
