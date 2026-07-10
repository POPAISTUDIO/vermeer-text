const { logger } = require('@librechat/data-schemas');
const cacheDebug = require('./cacheDebug');

describe('Vermeer cacheDebug', () => {
  let infoSpy;
  const ORIGINAL_FLAG = process.env.VERMEER_CACHE_DEBUG;

  const usage = {
    model: 'claude-opus-4-6',
    input_tokens: 12,
    cache_creation_input_tokens: 3400,
    cache_read_input_tokens: 0,
    output_tokens: 88,
  };
  const metadata = { thread_id: 'conv-1234567890', run_id: 'msg-abcdefghij' };
  const agent = {
    instructions: 'You are a helpful assistant.',
    additional_instructions: '# Existing memory about the user:\nlikes tea',
    tools: [{ name: 'web_search', description: 'search', schema: { type: 'object' } }],
  };
  const messages = [
    { _getType: () => 'human', content: 'bonjour' },
    { _getType: () => 'ai', content: 'salut' },
  ];

  beforeEach(() => {
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    if (ORIGINAL_FLAG === undefined) {
      delete process.env.VERMEER_CACHE_DEBUG;
    } else {
      process.env.VERMEER_CACHE_DEBUG = ORIGINAL_FLAG;
    }
  });

  describe('flag off (défaut)', () => {
    beforeEach(() => {
      delete process.env.VERMEER_CACHE_DEBUG;
    });

    it('isEnabled() est false', () => {
      expect(cacheDebug.isEnabled()).toBe(false);
    });

    it('logUsage n’émet aucun log', () => {
      cacheDebug.logUsage(usage, metadata);
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('logPrefix n’émet aucun log', () => {
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('une valeur ≠ "true" reste inactive', () => {
      process.env.VERMEER_CACHE_DEBUG = '1';
      cacheDebug.logUsage(usage, metadata);
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('flag on', () => {
    beforeEach(() => {
      process.env.VERMEER_CACHE_DEBUG = 'true';
    });

    it('logUsage émet une ligne avec les champs cache', () => {
      cacheDebug.logUsage(usage, metadata);
      expect(infoSpy).toHaveBeenCalledTimes(1);
      const line = infoSpy.mock.calls[0][0];
      expect(line).toContain('[Vermeer][CacheDebug] usage');
      expect(line).toContain('conv=conv-123');
      expect(line).toContain('msg=msg-abcd');
      expect(line).toContain('model=claude-opus-4-6');
      expect(line).toContain('cache_creation=3400');
      expect(line).toContain('cache_read=0');
      expect(line).toContain('output=88');
    });

    it('logUsage tronque conversationId et messageId à 8 caractères', () => {
      cacheDebug.logUsage(usage, metadata);
      const line = infoSpy.mock.calls[0][0];
      expect(line).toContain('conv=conv-123 ');
      expect(line).not.toContain('conv-1234567890');
    });

    it('logPrefix émet systemHash/toolsHash/msgHashes et msgCount', () => {
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      expect(infoSpy).toHaveBeenCalledTimes(1);
      const line = infoSpy.mock.calls[0][0];
      expect(line).toContain('[Vermeer][CacheDebug] prefix');
      expect(line).toMatch(/systemHash=[0-9a-f]{12}/);
      expect(line).toMatch(/instrHash=[0-9a-f]{12}/);
      expect(line).toMatch(/tailHash=[0-9a-f]{12}/);
      expect(line).toMatch(/toolsHash=[0-9a-f]{12}/);
      expect(line).toContain('msgCount=2');
      expect(line).toMatch(/msgHashes=\[[0-9a-f]{8},[0-9a-f]{8}\]/);
    });

    it('logPrefix ne loggue aucun contenu en clair', () => {
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      const line = infoSpy.mock.calls[0][0];
      expect(line).not.toContain('bonjour');
      expect(line).not.toContain('helpful assistant');
      expect(line).not.toContain('likes tea');
    });

    it('hashs stables pour un même input', () => {
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      expect(infoSpy.mock.calls[0][0]).toBe(infoSpy.mock.calls[1][0]);
    });

    it('tailHash change quand la mémoire injectée change (préfixe cassé)', () => {
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent, messages });
      const mutated = { ...agent, additional_instructions: 'likes coffee now' };
      cacheDebug.logPrefix({ conversationId: metadata.thread_id, agent: mutated, messages });
      const tail = (l) => l.match(/tailHash=([0-9a-f]{12})/)[1];
      expect(tail(infoSpy.mock.calls[0][0])).not.toBe(tail(infoSpy.mock.calls[1][0]));
    });

    it('logUsage survit à un usage undefined sans throw ni log', () => {
      expect(() => cacheDebug.logUsage(undefined, metadata)).not.toThrow();
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('logPrefix survit à un contenu circulaire sans throw', () => {
      const circular = { _getType: () => 'human', content: {} };
      circular.content.self = circular.content;
      expect(() =>
        cacheDebug.logPrefix({ conversationId: 'c', agent, messages: [circular] }),
      ).not.toThrow();
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });
  });
});
