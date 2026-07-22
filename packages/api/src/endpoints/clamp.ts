import { logger } from '@librechat/data-schemas';

/** Vermeer: bornes numériques d'un paramètre (sous-ensemble de SettingDefinition.range). */
interface ParamRange {
  min: number;
  max: number;
}

/**
 * Vermeer: clamp défensif d'un paramètre numérique dans ses bornes provider,
 * à la construction de la requête.
 *
 * Upstream ne clampe PAS les paramètres de sampling (pass-through intentionnel,
 * cf. le test `llm.spec.ts` « above max should pass through »). Une valeur hors
 * bornes persistée sur un agent — ex. `temperature=2` réglée sous OpenAI puis
 * provider basculé sur Anthropic (max 1), cf. issue #52 — part alors verbatim
 * vers l'API → 400 différé à la première utilisation (même classe que le fix
 * Gemini #50). Le clamp frontend (#54) ne protège que la modale builder ; ce
 * garde-fou couvre les agents déjà pollués en base et tout chemin d'écriture
 * non-UI (presets, addParams, round-trip DB).
 *
 * Conservateur : ne touche ni aux valeurs déjà dans les bornes, ni aux
 * non-nombres (`undefined`/`null`/`NaN` passent tels quels → aucune injection de
 * défaut). Le clamp est silencieux mais loggé en `warn` pour la traçabilité Loki.
 */
export function clampNumericParam<T>(
  value: T,
  range: ParamRange,
  meta: { provider: string; param: string; model?: string },
): T {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return value;
  }
  const clamped = Math.min(Math.max(value, range.min), range.max);
  if (clamped !== value) {
    logger.warn(
      `[${meta.provider}] Vermeer clamp: ${meta.param}=${value} hors [${range.min}, ${range.max}] -> ${clamped} (model=${meta.model ?? 'n/a'})`,
    );
  }
  return clamped as unknown as T;
}
