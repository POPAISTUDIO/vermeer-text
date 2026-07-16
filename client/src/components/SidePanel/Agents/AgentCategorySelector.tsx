import React, { memo, useState } from 'react';
import { ControlCombobox } from '@librechat/client';
import {
  useWatch,
  FieldPath,
  Controller,
  FieldValues,
  useFormContext,
  ControllerRenderProps,
} from 'react-hook-form';
import { TranslationKeys, useLocalize, useAgentCategories } from '~/hooks';
import {
  DEFAULT_AGENT_CATEGORY,
  CATEGORY_DISPLAY_REMAP,
  toCanonicalCategory,
} from '~/constants/agentCategories';
import { cn } from '~/utils';

/**
 * Custom hook to handle category synchronization.
 *
 * Vermeer: runs once per agent (AgentPanel remounts via key={agent_id}). New agents get
 * DEFAULT_AGENT_CATEGORY ; existing agents holding a legacy/v1 value get remapped to their
 * canonical v2 category so it is preselected in the picker and persisted on Save (soft
 * migration on edit — the DB value is only rewritten when the assistant is saved).
 */
const useCategorySync = (agent_id: string | null) => {
  const [handled, setHandled] = useState(false);

  return {
    syncCategory: <T extends FieldPath<FieldValues>>(
      field: ControllerRenderProps<FieldValues, T>,
    ) => {
      if (handled) {
        return;
      }
      if (agent_id === '' && !field.value) {
        field.onChange(DEFAULT_AGENT_CATEGORY);
        setHandled(true);
        return;
      }
      if (field.value && CATEGORY_DISPLAY_REMAP[field.value]) {
        field.onChange(CATEGORY_DISPLAY_REMAP[field.value]);
        setHandled(true);
      }
    },
  };
};

/**
 * A component for selecting agent categories with form validation
 */
const AgentCategorySelector: React.FC<{ className?: string }> = ({ className }) => {
  const localize = useLocalize();
  const formContext = useFormContext();
  const { categories } = useAgentCategories();

  const agent_id = useWatch({
    name: 'id',
    control: formContext.control,
  });

  const { syncCategory } = useCategorySync(agent_id);
  const getCategoryLabel = (category: { label: string; value: string }) => {
    if (category.label && category.label.startsWith('com_')) {
      return localize(category.label as TranslationKeys);
    }
    return category.label;
  };

  const comboboxItems = categories.map((category) => ({
    label: getCategoryLabel(category),
    value: category.value,
  }));

  const getCategoryDisplayValue = (value: string) => {
    // Vermeer: normalise la valeur (v1/legacy) vers sa catégorie canonique v2 pour l'affichage.
    const canonical = toCanonicalCategory(value);
    const categoryItem = comboboxItems.find((c) => c.value === canonical);
    return (
      categoryItem?.label || comboboxItems.find((c) => c.value === DEFAULT_AGENT_CATEGORY)?.label
    );
  };

  const searchPlaceholder = localize('com_ui_search_agent_category');
  const ariaLabel = localize('com_ui_agent_category_selector_aria');

  return (
    <Controller
      name="category"
      control={formContext.control}
      defaultValue={DEFAULT_AGENT_CATEGORY}
      render={({ field }) => {
        // Sync category if needed (without using useEffect in render)
        syncCategory(field);

        const displayValue = getCategoryDisplayValue(field.value);

        return (
          <ControlCombobox
            selectedValue={toCanonicalCategory(field.value)}
            displayValue={displayValue}
            searchPlaceholder={searchPlaceholder}
            setValue={(value) => {
              field.onChange(value);
            }}
            items={comboboxItems}
            className={cn(className)}
            ariaLabel={ariaLabel}
            isCollapsed={false}
            showCarat={true}
          />
        );
      }}
    />
  );
};

const MemoizedAgentCategorySelector = memo(
  AgentCategorySelector,
  (prevProps, nextProps) => prevProps.className === nextProps.className,
);
MemoizedAgentCategorySelector.displayName = 'AgentCategorySelector';

export default MemoizedAgentCategorySelector;
