import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import { stripEmptyTextBlocks, stripServerToolParts } from './sanitize';

const textPart = (text: string): TMessageContentParts => ({ type: ContentTypes.TEXT, text });

const imagePart = (url: string): TMessageContentParts =>
  ({ type: ContentTypes.IMAGE_URL, image_url: { url } }) as unknown as TMessageContentParts;

const toolCallPart = (
  id: string,
  { output, name = 'web_search' }: { output?: string; name?: string } = {},
): TMessageContentParts =>
  ({
    type: ContentTypes.TOOL_CALL,
    tool_call: { type: 'tool_call', id, name, args: {}, ...(output != null ? { output } : {}) },
  }) as unknown as TMessageContentParts;

describe('stripEmptyTextBlocks', () => {
  it('removes the empty text block from an image-only message but keeps the image', () => {
    const image = imagePart('https://example.com/a.png');
    const messages = [{ role: 'user', content: [image, textPart('')] }];

    const result = stripEmptyTextBlocks(messages);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual([image]);
  });

  it('empties a whitespace-only string message without media so the SDK skips it', () => {
    const messages = [{ role: 'user', content: '   ' }];

    const result = stripEmptyTextBlocks(messages);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual([]);
  });

  it('leaves an empty string message untouched when it carries media', () => {
    const messages = [{ role: 'user', content: '', image_urls: [imagePart('x')] }];

    const result = stripEmptyTextBlocks(messages);

    expect(result[0].content).toBe('');
  });

  it('leaves a non-empty string message unchanged', () => {
    const messages = [{ role: 'user', content: 'eh ho' }];

    const result = stripEmptyTextBlocks(messages);

    expect(result[0].content).toBe('eh ho');
  });

  it('removes only the empty text part from a mixed array', () => {
    const image = imagePart('https://example.com/b.png');
    const full = textPart('hello');
    const messages = [{ role: 'user', content: [textPart('  '), full, image] }];

    const result = stripEmptyTextBlocks(messages);

    expect(result[0].content).toEqual([full, image]);
  });

  it('preserves the messages array length across all cases', () => {
    const messages = [
      { role: 'user', content: 'normal' },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: [textPart(''), textPart('answer')] },
      { role: 'user', content: '', files: [{ file_id: 'f1' }] },
    ];

    const result = stripEmptyTextBlocks(messages);

    expect(result).toHaveLength(messages.length);
  });
});

describe('stripServerToolParts', () => {
  it('removes the server-tool call part from an assistant message, keeping text and tool_call_ids', () => {
    const answer: TMessageContentParts = {
      type: ContentTypes.TEXT,
      text: "Voici ce que j'ai trouvé [1][2]",
      tool_call_ids: ['srvtoolu_abc'],
    } as unknown as TMessageContentParts;
    const messages = [
      {
        role: 'assistant',
        content: [toolCallPart('srvtoolu_abc', { output: '<results>' }), answer],
      },
    ];

    const result = stripServerToolParts(messages);

    expect(result[0].content).toEqual([answer]);
  });

  it('leaves an assistant message with a client tool call unchanged', () => {
    const messages = [
      {
        role: 'assistant',
        content: [toolCallPart('toolu_x', { name: 'calculator' }), textPart('hi')],
      },
    ];

    const result = stripServerToolParts(messages);

    expect(result[0]).toBe(messages[0]);
  });

  it('leaves a text-only assistant message unchanged', () => {
    const messages = [{ role: 'assistant', content: [textPart('plain answer')] }];

    const result = stripServerToolParts(messages);

    expect(result[0]).toBe(messages[0]);
  });

  it('leaves a user message unchanged even if it carries a server-tool part', () => {
    const messages = [{ role: 'user', content: [toolCallPart('srvtoolu_x'), textPart('q')] }];

    const result = stripServerToolParts(messages);

    expect(result[0]).toBe(messages[0]);
  });

  it('reduces an assistant message whose only part is a server tool to empty content', () => {
    const messages = [{ role: 'assistant', content: [toolCallPart('srvtoolu_only')] }];

    const result = stripServerToolParts(messages);

    expect(result[0].content).toEqual([]);
  });

  it('leaves an assistant message with string content unchanged', () => {
    const messages = [{ role: 'assistant', content: 'string answer' }];

    const result = stripServerToolParts(messages);

    expect(result[0]).toBe(messages[0]);
    expect(result[0].content).toBe('string answer');
  });

  it('does not remove a tool call with a missing or empty id', () => {
    const noId = {
      type: ContentTypes.TOOL_CALL,
      tool_call: { name: 'web_search', args: {} },
    } as unknown as TMessageContentParts;
    const emptyId = toolCallPart('');
    const messages = [{ role: 'assistant', content: [noId, emptyId] }];

    const result = stripServerToolParts(messages);

    expect(result[0]).toBe(messages[0]);
  });

  it('removes only the server-tool part from a mixed assistant message', () => {
    const clientCall = toolCallPart('toolu_client', { name: 'calculator' });
    const answer = textPart('done');
    const messages = [
      { role: 'assistant', content: [toolCallPart('srvtoolu_x'), clientCall, answer] },
    ];

    const result = stripServerToolParts(messages);

    expect(result[0].content).toEqual([clientCall, answer]);
  });

  it('preserves the messages array length across all cases', () => {
    const messages = [
      { role: 'user', content: [textPart('q')] },
      { role: 'assistant', content: [toolCallPart('srvtoolu_x'), textPart('a')] },
      { role: 'assistant', content: 'string' },
    ];

    const result = stripServerToolParts(messages);

    expect(result).toHaveLength(messages.length);
  });
});
