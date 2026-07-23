import { MAX_SUBAGENTS } from 'librechat-data-provider';
import { agentCreateSchema, agentUpdateSchema, agentSubagentsSchema } from './validation';

describe('agentSubagentsSchema', () => {
  it('accepts enabled:true with a list within the cap', () => {
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      allowSelf: false,
      agent_ids: ['agent_1', 'agent_2'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts the feature-off shape (enabled:false, no agents)', () => {
    const result = agentSubagentsSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });

  it('rejects agent_ids longer than MAX_SUBAGENTS', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 1 }, (_, i) => `agent_${i}`);
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      agent_ids: oversized,
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly MAX_SUBAGENTS entries', () => {
    const atCap = Array.from({ length: MAX_SUBAGENTS }, (_, i) => `agent_${i}`);
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      agent_ids: atCap,
    });
    expect(result.success).toBe(true);
  });
});

describe('agentCreateSchema with subagents', () => {
  const base = {
    provider: 'openAI',
    model: 'gpt-4o-mini',
    tools: [],
  };

  it('passes with subagents omitted', () => {
    const result = agentCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('passes with a valid subagents config', () => {
    const result = agentCreateSchema.safeParse({
      ...base,
      subagents: { enabled: true, allowSelf: true, agent_ids: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when subagents.agent_ids exceeds the cap', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 1 }, (_, i) => `agent_${i}`);
    const result = agentCreateSchema.safeParse({
      ...base,
      subagents: { enabled: true, agent_ids: oversized },
    });
    expect(result.success).toBe(false);
  });
});

describe('agentUpdateSchema with subagents', () => {
  it('accepts a partial update with only the disabled flag set', () => {
    const result = agentUpdateSchema.safeParse({
      subagents: { enabled: false, allowSelf: true, agent_ids: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects oversized agent_ids on update', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 3 }, (_, i) => `agent_${i}`);
    const result = agentUpdateSchema.safeParse({
      subagents: { enabled: true, agent_ids: oversized },
    });
    expect(result.success).toBe(false);
  });
});

describe('agentCreateSchema name/description length bounds (AST-05)', () => {
  const base = {
    provider: 'openAI',
    model: 'gpt-4o-mini',
    tools: [],
  };

  it('accepts a name of exactly 256 characters', () => {
    const result = agentCreateSchema.safeParse({ ...base, name: 'a'.repeat(256) });
    expect(result.success).toBe(true);
  });

  it('rejects a name of 257 characters', () => {
    const result = agentCreateSchema.safeParse({ ...base, name: 'a'.repeat(257) });
    expect(result.success).toBe(false);
  });

  it('accepts a description of exactly 512 characters', () => {
    const result = agentCreateSchema.safeParse({ ...base, description: 'a'.repeat(512) });
    expect(result.success).toBe(true);
  });

  it('rejects a description of 513 characters', () => {
    const result = agentCreateSchema.safeParse({ ...base, description: 'a'.repeat(513) });
    expect(result.success).toBe(false);
  });

  it('accepts null and undefined name/description', () => {
    expect(agentCreateSchema.safeParse({ ...base, name: null }).success).toBe(true);
    expect(agentCreateSchema.safeParse({ ...base, description: null }).success).toBe(true);
    expect(agentCreateSchema.safeParse(base).success).toBe(true);
  });
});

describe('agentUpdateSchema name/description length bounds (AST-05)', () => {
  it('rejects an update whose name exceeds 256 characters', () => {
    const result = agentUpdateSchema.safeParse({ name: 'a'.repeat(257) });
    expect(result.success).toBe(false);
  });

  it('rejects an update whose description exceeds 512 characters', () => {
    const result = agentUpdateSchema.safeParse({ description: 'a'.repeat(513) });
    expect(result.success).toBe(false);
  });

  it('accepts an in-bounds partial update', () => {
    const result = agentUpdateSchema.safeParse({
      name: 'a'.repeat(256),
      description: 'b'.repeat(512),
    });
    expect(result.success).toBe(true);
  });
});
