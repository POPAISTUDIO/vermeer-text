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
