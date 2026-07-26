/**
 * Catalogue attendu du sélecteur de modèles (cas SEL-01 du cahier de recettes).
 *
 * Source de vérité : la ligne SEL-01 de la recette triée. Ce n'est PAS une copie de la
 * config de l'environnement : si l'environnement évolue, c'est la recette qui doit être
 * mise à jour d'abord, puis ce fichier — pas l'inverse.
 */

export type ModelGroup = {
  /** Nom du groupe tel qu'affiché dans le sélecteur. */
  group: string;
  /** Libellés attendus, dans l'ordre attendu quand `ordered` est vrai. */
  models: string[];
  /** L'ordre est-il asservi (SEL-01 ne l'impose explicitement que pour OpenAI) ? */
  ordered: boolean;
};

export const EXPECTED_CATALOGUE: ModelGroup[] = [
  {
    group: 'OpenAI',
    ordered: true,
    models: [
      'GPT-5.2 (Équilibré)',
      'GPT-5.5 (Puissant)',
      'GPT-5.1 (Legacy)',
      'GPT-5.4-mini (Rapide)',
      'GPT-5.4-nano (Éco)',
      'GPT-5-mini (Legacy)',
      'GPT-4o (Legacy)',
    ],
  },
  {
    group: 'Anthropic',
    ordered: false,
    models: [
      'Opus 4.8 (Puissant)',
      'Opus 4.7 (Puissant)',
      'Opus 4.6 (Puissant)',
      'Sonnet 4.6 (Équilibré)',
      'Haiku 4.5 (Rapide)',
    ],
  },
  {
    group: 'Google',
    ordered: false,
    models: [
      'Gemini 3.1 Pro preview',
      'Gemini 3 Flash preview',
      'Gemini 2.5 Pro',
      'Gemini 2.5 Flash',
      'Gemini 2.5 Flash-lite',
    ],
  },
  {
    group: 'French Models',
    ordered: false,
    models: ['French-Alpaca Llama 3 8B (FR)'],
  },
];

/** Modèle explicitement retiré de la config : sa présence est une régression. */
export const FORBIDDEN_MODELS = ['gemini-2.0-flash-001'];

/** Modèle OpenAI par défaut attendu sur une conversation neuve (GEN-03). */
export const DEFAULT_MODEL_LABEL = 'GPT-5.2 (Équilibré)';
