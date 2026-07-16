import { TranslationKeys } from '~/hooks/useLocalize';

export interface AgentCategory {
  label: TranslationKeys;
  description?: TranslationKeys;
  value: string;
}

// Vermeer: catégorie par défaut à la création (taxonomie v2 — remplace 'general').
export const DEFAULT_AGENT_CATEGORY = 'expertises_digitales';

// The empty category placeholder - used for form defaults
export const EMPTY_AGENT_CATEGORY: AgentCategory = {
  value: '',
  label: 'com_ui_agent_category_general',
};

// Vermeer: taxonomie v2 — 6 catégories métier validées, source unique pour le builder
// + la page Assistants. L'emoji est embarqué directement dans le label i18n.
export const VERMEER_AGENT_CATEGORIES: AgentCategory[] = [
  {
    value: 'conception_ecriture',
    label: 'com_agents_category_conception_ecriture',
    description: 'com_agents_category_conception_ecriture_description',
  },
  {
    value: 'strategie',
    label: 'com_agents_category_strategie',
    description: 'com_agents_category_strategie_description',
  },
  {
    value: 'gestion_projet',
    label: 'com_agents_category_gestion_projet',
    description: 'com_agents_category_gestion_projet_description',
  },
  {
    value: 'data_finance',
    label: 'com_agents_category_data_finance',
    description: 'com_agents_category_data_finance_description',
  },
  {
    value: 'production',
    label: 'com_agents_category_production',
    description: 'com_agents_category_production_description',
  },
  {
    value: 'expertises_digitales',
    label: 'com_agents_category_expertises_digitales',
    description: 'com_agents_category_expertises_digitales_description',
  },
];

// Vermeer: remapping d'AFFICHAGE — valeur DB existante (taxonomie v1 + IDs legacy) → valeur
// canonique v2. Les valeurs en base des assistants existants ne changent PAS ; seul l'affichage
// (badge de carte, onglet, présélection du picker) est remappé. La migration en base se fait en
// douceur au Save d'un assistant édité (cf. AgentCategorySelector).
export const CATEGORY_DISPLAY_REMAP: Record<string, string> = {
  creative: 'conception_ecriture',
  strategic: 'strategie',
  media: 'production',
  general: 'expertises_digitales',
  finance: 'data_finance',
  hr: 'expertises_digitales',
  rd: 'expertises_digitales',
  it: 'expertises_digitales',
  sales: 'expertises_digitales',
  aftersales: 'expertises_digitales',
};

// Vermeer: alias inverse — valeur canonique v2 → toutes les valeurs DB à afficher dessous
// (elle-même + les valeurs v1/legacy remappées). Sert au filtrage des onglets pour que les
// assistants existants (ex. 'media') soient comptés dans le bon onglet ('production').
export const CATEGORY_VALUE_ALIASES: Record<string, string[]> = VERMEER_AGENT_CATEGORIES.reduce<
  Record<string, string[]>
>((acc, { value }) => {
  const legacy = Object.keys(CATEGORY_DISPLAY_REMAP).filter(
    (dbValue) => CATEGORY_DISPLAY_REMAP[dbValue] === value,
  );
  acc[value] = [value, ...legacy];
  return acc;
}, {});

/** Vermeer: étend une valeur de catégorie canonique vers toutes ses valeurs DB (pour le filtrage). */
export const expandCategoryValue = (value: string): string[] =>
  CATEGORY_VALUE_ALIASES[value] ?? [value];

/** Vermeer: normalise une valeur DB (v1/legacy) vers sa valeur canonique v2. */
export const toCanonicalCategory = (value: string): string =>
  CATEGORY_DISPLAY_REMAP[value] ?? value;
