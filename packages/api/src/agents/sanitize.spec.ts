import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import { stripEmptyTextBlocks } from './sanitize';

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
