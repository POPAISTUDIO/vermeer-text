import { useCallback, useMemo } from 'react';

import useLocalize from '~/hooks/useLocalize';
import {
  EMPTY_AGENT_CATEGORY,
  VERMEER_AGENT_CATEGORIES,
  DEFAULT_AGENT_CATEGORY,
  toCanonicalCategory,
} from '~/constants/agentCategories';

// This interface matches the structure used by the ControlCombobox component
export interface ProcessedAgentCategory {
  label: string; // Translated label
  description?: string; // Translated description
  value: string; // Category value
  className?: string;
  icon?: string;
}

/**
 * Custom hook providing the Vermeer V1 agent categories (hardcoded, single
 * source of truth for the builder + Marketplace). The backend `/api/categories`
 * endpoint is no longer consulted — categories are defined in
 * VERMEER_AGENT_CATEGORIES.
 *
 * Also exposes `getCategoryLabel(value)`: resolves a category value to its
 * translated label. Values stored on existing agents (taxonomie v1 + IDs
 * legacy) are remapped to their canonical v2 category via toCanonicalCategory
 * so they render cleanly under the new taxonomy instead of falling through to
 * the raw ID or an empty badge.
 */
const useAgentCategories = () => {
  const localize = useLocalize();

  const categories = useMemo(
    (): ProcessedAgentCategory[] =>
      VERMEER_AGENT_CATEGORIES.map((category) => ({
        label: localize(category.label),
        description: category.description ? localize(category.description) : undefined,
        value: category.value,
        className: 'w-full',
      })),
    [localize],
  );

  const emptyCategory = useMemo(
    (): ProcessedAgentCategory => ({
      label: localize(EMPTY_AGENT_CATEGORY.label),
      value: EMPTY_AGENT_CATEGORY.value,
      className: 'w-full',
    }),
    [localize],
  );

  const getCategoryLabel = useCallback(
    (value: string | null | undefined): string => {
      const fallback = categories.find((c) => c.value === DEFAULT_AGENT_CATEGORY)?.label ?? '';
      if (!value) {
        return fallback;
      }
      const canonical = toCanonicalCategory(value);
      return categories.find((c) => c.value === canonical)?.label ?? fallback;
    },
    [categories],
  );

  return {
    categories,
    emptyCategory,
    getCategoryLabel,
    isLoading: false,
    error: null,
  };
};

export default useAgentCategories;
