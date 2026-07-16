import React from 'react';
import { useLocalize, TranslationKeys } from '~/hooks';
import { cn } from '~/utils';

// Vermeer: filtre de propriété sur la page Assistants (WAGON C).
// 'all' = tout ; 'shared' = partagés/publics non-miens ; 'mine' = author === user.id.
export type OwnershipFilter = 'all' | 'shared' | 'mine';

interface OwnershipFilterTabsProps {
  /** Currently selected ownership filter */
  value: OwnershipFilter;
  /** Callback fired when a filter is selected */
  onChange: (value: OwnershipFilter) => void;
}

const options: { value: OwnershipFilter; label: TranslationKeys }[] = [
  { value: 'all', label: 'com_vermeer_ownership_all' },
  { value: 'shared', label: 'com_vermeer_ownership_shared' },
  { value: 'mine', label: 'com_vermeer_ownership_mine' },
];

/**
 * OwnershipFilterTabs - Segmented control to filter the assistants grid by ownership.
 *
 * Combines with the category tabs (intersection). Local state, not persisted.
 */
const OwnershipFilterTabs: React.FC<OwnershipFilterTabsProps> = ({ value, onChange }) => {
  const localize = useLocalize();

  return (
    <div
      className="flex flex-wrap justify-center gap-1.5"
      role="group"
      aria-label={localize('com_vermeer_ownership_label')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'relative cursor-pointer select-none whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-all duration-200',
            value === option.value
              ? 'bg-surface-hover text-text-primary'
              : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary active:scale-95',
          )}
          aria-pressed={value === option.value}
        >
          {localize(option.label)}
        </button>
      ))}
    </div>
  );
};

export default OwnershipFilterTabs;
