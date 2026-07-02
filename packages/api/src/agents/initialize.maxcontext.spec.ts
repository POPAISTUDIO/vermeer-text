import { resolveUserMaxContextTokens } from './initialize';

/**
 * Vermeer: anti-echo guard for maxContextTokens persistence.
 * A value equal to the computed system window is a client echo (conversation reloaded from DB
 * or inherited via LAST_CONVO_SETUP), not a deliberate user entry, and must not be persisted.
 */
describe('resolveUserMaxContextTokens (Vermeer anti-echo)', () => {
  const computed = 68400;

  it('echo: received equals the computed system window -> not persisted (undefined)', () => {
    expect(resolveUserMaxContextTokens(computed, computed)).toBeUndefined();
  });

  it('deliberate: received differs from computed -> persisted as-is', () => {
    expect(resolveUserMaxContextTokens(32000, computed)).toBe(32000);
  });

  it('"Système": received undefined/null -> not persisted (undefined)', () => {
    expect(resolveUserMaxContextTokens(undefined, computed)).toBeUndefined();
    expect(resolveUserMaxContextTokens(null, computed)).toBeUndefined();
  });

  it('non-positive values are treated as system (undefined)', () => {
    expect(resolveUserMaxContextTokens(0, computed)).toBeUndefined();
    expect(resolveUserMaxContextTokens(-1, computed)).toBeUndefined();
  });
});
