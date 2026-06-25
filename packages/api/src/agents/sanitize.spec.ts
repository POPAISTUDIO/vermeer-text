import { ContentTypes } from 'librechat-data-provider';
import { AIMessage, HumanMessage, ToolMessage } from '@librechat/agents/langchain/messages';
import type { TMessageContentParts } from 'librechat-data-provider';
import { stripEmptyTextBlocks, sanitizeServerToolMessages } from './sanitize';

const textPart = (text: string): TMessageContentParts => ({ type: ContentTypes.TEXT, text });

const imagePart = (url: string): TMessageContentParts =>
  ({ type: ContentTypes.IMAGE_URL, image_url: { url } }) as unknown as TMessageContentParts;

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

const serverToolCall = (id: string) => ({ id, name: 'web_search', args: {} });

describe('sanitizeServerToolMessages', () => {
  it('fills empty content of an all-server-tool AIMessage with a placeholder, leaving tool_calls and identity intact', () => {
    const toolCalls = [serverToolCall('srvtoolu_abc')];
    const message = new AIMessage({ content: '', tool_calls: toolCalls });
    const messages = [message];

    const result = sanitizeServerToolMessages(messages);

    expect(result[0]).toBe(message);
    expect(result[0].content).toBe('.');
    expect((result[0] as AIMessage).tool_calls).toEqual(toolCalls);
  });

  it('fills a whitespace-only content of an all-server-tool AIMessage', () => {
    const message = new AIMessage({ content: '   ', tool_calls: [serverToolCall('srvtoolu_x')] });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toBe('.');
  });

  it('leaves an empty AIMessage whose tool_calls are client tools unchanged', () => {
    const toolu = new AIMessage({
      content: '',
      tool_calls: [{ id: 'toolu_client', name: 'calculator', args: {} }],
    });
    const call = new AIMessage({
      content: '',
      tool_calls: [{ id: 'call_client', name: 'calculator', args: {} }],
    });

    const result = sanitizeServerToolMessages([toolu, call]);

    expect(result[0].content).toBe('');
    expect(result[1].content).toBe('');
  });

  it('leaves an empty AIMessage with mixed server and client tool_calls unchanged', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        serverToolCall('srvtoolu_x'),
        { id: 'toolu_client', name: 'calculator', args: {} },
      ],
    });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toBe('');
  });

  it('leaves an AIMessage with non-empty content unchanged', () => {
    const message = new AIMessage({
      content: 'réponse',
      tool_calls: [serverToolCall('srvtoolu_x')],
    });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toBe('réponse');
  });

  it('leaves an AIMessage with array content unchanged (string path only)', () => {
    const content = [{ type: 'text', text: 'x' }];
    const message = new AIMessage({ content, tool_calls: [serverToolCall('srvtoolu_x')] });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toEqual(content);
  });

  it('leaves an empty AIMessage without tool_calls unchanged', () => {
    const message = new AIMessage({ content: '' });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toBe('');
  });

  it('leaves an empty AIMessage whose tool_call has no id unchanged', () => {
    const message = new AIMessage({ content: '', tool_calls: [{ name: 'web_search', args: {} }] });

    const result = sanitizeServerToolMessages([message]);

    expect(result[0].content).toBe('');
  });

  it('never touches HumanMessage or ToolMessage', () => {
    const human = new HumanMessage({ content: '' });
    const tool = new ToolMessage({ content: '', tool_call_id: 'srvtoolu_x', name: 'web_search' });

    const result = sanitizeServerToolMessages([human, tool]);

    expect(result[0].content).toBe('');
    expect(result[1].content).toBe('');
  });

  it('preserves length and order, keeping the following tool result intact', () => {
    const human = new HumanMessage({ content: 'cherche X' });
    const healed = new AIMessage({ content: '', tool_calls: [serverToolCall('srvtoolu_x')] });
    const toolResult = new ToolMessage({
      content: '<results>',
      tool_call_id: 'srvtoolu_x',
      name: 'web_search',
    });
    const answer = new AIMessage({ content: 'voici la réponse' });
    const messages = [human, healed, toolResult, answer];

    const result = sanitizeServerToolMessages(messages);

    expect(result).toHaveLength(4);
    expect(result[0]).toBe(human);
    expect(result[1]).toBe(healed);
    expect(result[2]).toBe(toolResult);
    expect(result[3]).toBe(answer);
    expect(result[1].content).toBe('.');
    expect(result[2]).toBeInstanceOf(ToolMessage);
    expect(result[2].content).toBe('<results>');
    expect(result[3].content).toBe('voici la réponse');
  });
});
