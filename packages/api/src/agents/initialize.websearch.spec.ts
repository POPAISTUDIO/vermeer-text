import { shouldDefaultAgentWebSearch } from './initialize';

/**
 * Vermeer: agent-path mirror of the native web_search default.
 * The `agents` endpoint is not in `nativeWebSearchEndpoints`, so the direct-conversation
 * default never reached assistants. This helper re-applies the same contract at agent
 * runtime: default ON only when the value is undefined AND the raw provider is native.
 */
describe('shouldDefaultAgentWebSearch (Vermeer agent web_search default)', () => {
  it('undefined + native provider -> defaults ON', () => {
    expect(shouldDefaultAgentWebSearch(undefined, 'openAI')).toBe(true);
    expect(shouldDefaultAgentWebSearch(undefined, 'azureOpenAI')).toBe(true);
    expect(shouldDefaultAgentWebSearch(undefined, 'anthropic')).toBe(true);
    expect(shouldDefaultAgentWebSearch(undefined, 'google')).toBe(true);
  });

  it('explicit false + native provider -> never overwritten', () => {
    expect(shouldDefaultAgentWebSearch(false, 'openAI')).toBe(false);
  });

  it('explicit true + native provider -> no-op (already set)', () => {
    expect(shouldDefaultAgentWebSearch(true, 'openAI')).toBe(false);
  });

  it('undefined + custom endpoint -> excluded (anti-400 guard)', () => {
    expect(shouldDefaultAgentWebSearch(undefined, 'French Models')).toBe(false);
    expect(shouldDefaultAgentWebSearch(undefined, 'xai')).toBe(false);
    expect(shouldDefaultAgentWebSearch(undefined, 'deepseek')).toBe(false);
  });

  it('undefined + missing provider -> excluded', () => {
    expect(shouldDefaultAgentWebSearch(undefined, undefined)).toBe(false);
    expect(shouldDefaultAgentWebSearch(undefined, null)).toBe(false);
    expect(shouldDefaultAgentWebSearch(undefined, '')).toBe(false);
  });
});
