import React, { useMemo } from 'react';
import { ListFilter } from 'lucide-react';
import { Dropdown } from '@librechat/client';
import { useLocalize } from '~/hooks';

// Vermeer: filtre de propriété sur la page Assistants (WAGON C).
// 'all' = tout ; 'shared' = partagés/publics non-miens ; 'mine' = author === user.id.
export type OwnershipFilter = 'all' | 'shared' | 'mine';

interface OwnershipFilterSelectProps {
  /** Currently selected ownership filter */
  value: OwnershipFilter;
  /** Callback fired when a filter is selected */
  onChange: (value: OwnershipFilter) => void;
}

/**
 * OwnershipFilterSelect - Compact dropdown (design-system Dropdown) to filter the assistants
 * grid by ownership. Combines with the category tabs (intersection). Local state, not persisted.
 * L'icône filtre le distingue visuellement des onglets catégories.
 */
const OwnershipFilterSelect: React.FC<OwnershipFilterSelectProps> = ({ value, onChange }) => {
  const localize = useLocalize();

  const options = useMemo(
    () => [
      { value: 'all', label: localize('com_vermeer_ownership_all') },
      { value: 'shared', label: localize('com_vermeer_ownership_shared') },
      { value: 'mine', label: localize('com_vermeer_ownership_mine') },
    ],
    [localize],
  );

  return (
    <Dropdown
      value={value}
      onChange={(next) => onChange(next as OwnershipFilter)}
      options={options}
      icon={<ListFilter className="icon-sm" aria-hidden="true" />}
      ariaLabel={localize('com_vermeer_ownership_label')}
      sizeClasses="w-[190px]"
      className="z-10"
    />
  );
};

export default OwnershipFilterSelect;
