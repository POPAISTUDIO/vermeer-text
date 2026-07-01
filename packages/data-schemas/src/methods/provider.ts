// Vermeer: single source of truth for model -> provider mapping (analytics "cost by provider").
// Vermeer: the `transactions` collection has no direct provider/endpoint field, and the message
// Vermeer: `endpoint` masks the real provider for agent traffic — so we map on the raw model name.
// Vermeer: rules are defined ONCE as data and both outputs (JS + Mongo $switch) derive from them.
// Vermeer: aligned on config/vermeer-cost-by-provider.js (anchored prefixes). V1 granularity:
// Vermeer: Anthropic / Google / OpenAI / Other (no Vertex split).

/** A MongoDB aggregation expression (JSON-like tree of operators, literals and field paths). */
type AggExpr = string | number | boolean | null | AggExpr[] | { [key: string]: AggExpr };

// Vermeer: one prefix rule per (case-insensitive) model-name prefix; first match wins, fallback 'Other'.
export interface ProviderRule {
  prefix: string;
  provider: string;
}

// Vermeer: THE list — every derived output below is built from this and nothing else.
export const PROVIDER_RULES: ProviderRule[] = [
  { prefix: 'claude-', provider: 'Anthropic' },
  { prefix: 'gemini-', provider: 'Google' },
  { prefix: 'gpt-', provider: 'OpenAI' },
  { prefix: 'o1', provider: 'OpenAI' },
  { prefix: 'o3', provider: 'OpenAI' },
  { prefix: 'o4', provider: 'OpenAI' },
];

// Vermeer: fallback provider when no prefix matches.
export const PROVIDER_FALLBACK = 'Other';

/**
 * Vermeer: maps a model name to its provider (pure JS, case-insensitive prefix match).
 * Mirrors providerSwitchExpr — same rules, same fallback.
 */
export function mapProvider(model?: string | null): string {
  const normalized = String(model ?? '').toLowerCase();
  for (const rule of PROVIDER_RULES) {
    if (normalized.startsWith(rule.prefix)) {
      return rule.provider;
    }
  }
  return PROVIDER_FALLBACK;
}

/**
 * Vermeer: MongoDB `$switch` expression mapping a model field to its provider, derived from
 * PROVIDER_RULES. Case-insensitive (the field is lower-cased first). Mirrors mapProvider.
 * @param modelFieldRef aggregation field path to the model name (e.g. '$model')
 */
export function providerSwitchExpr(modelFieldRef: string): AggExpr {
  const lowered: AggExpr = { $toLower: { $ifNull: [modelFieldRef, ''] } };
  return {
    $switch: {
      branches: PROVIDER_RULES.map((rule) => ({
        case: { $regexMatch: { input: lowered, regex: `^${rule.prefix}` } },
        then: rule.provider,
      })),
      default: PROVIDER_FALLBACK,
    },
  };
}
