import { useState, useEffect } from 'react';
import { Label, Switch, useToastContext } from '@librechat/client';
import { useGetUserQuery, useUpdateMemoryPreferencesMutation } from '~/data-provider';
import usePersonalizationAccess from '~/hooks/usePersonalizationAccess';
import { useLocalize } from '~/hooks';

/**
 * Toggle « Mémoire automatique » du panneau Paramètres, à côté de Recherche web.
 *
 * Agit sur la préférence UTILISATEUR `user.personalization.memories` (persistée en
 * DB via useUpdateMemoryPreferencesMutation) — et NON sur un paramètre de
 * conversation : on ne réutilise donc pas DynamicSwitch/setOption.
 *
 * ON par défaut (le champ vaut `true` côté schéma) ; l'utilisateur peut couper.
 * Se masque si l'utilisateur n'a pas la permission MEMORIES/OPT_OUT (gating natif
 * via usePersonalizationAccess) — donc disparaît tout seul si la mémoire n'est pas
 * activée sur l'instance (portabilité Ava).
 */
function MemorySwitch() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { hasMemoryOptOut } = usePersonalizationAccess();
  const { data: user } = useGetUserQuery();
  const [enabled, setEnabled] = useState(true);

  const updateMemoryPreferencesMutation = useUpdateMemoryPreferencesMutation({
    onSuccess: () => {
      showToast({ message: localize('com_ui_preferences_updated'), status: 'success' });
    },
    onError: () => {
      showToast({ message: localize('com_ui_error_updating_preferences'), status: 'error' });
      setEnabled((prev) => !prev);
    },
  });

  useEffect(() => {
    if (user?.personalization?.memories !== undefined) {
      setEnabled(user.personalization.memories);
    }
  }, [user?.personalization?.memories]);

  if (!hasMemoryOptOut) {
    return null;
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    updateMemoryPreferencesMutation.mutate({ memories: checked });
  };

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="memory-auto-capture-switch"
          // Vermeer: la primitive Label impose `block w-full` → le <label> remplit la
          // ligne et, via htmlFor, tout clic dans l'espace vide bascule le switch. `w-fit`
          // restreint la zone cliquable au libellé (htmlFor intact, layout `justify-between`
          // inchangé). Même correctif que DynamicSwitch (fix QA n°7).
          className="w-fit break-words text-left text-xs font-medium"
        >
          {localize('com_ui_memory_auto_capture')}
        </Label>
        <Switch
          id="memory-auto-capture-switch"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={updateMemoryPreferencesMutation.isLoading}
          className="flex"
          aria-label={localize('com_ui_memory_auto_capture')}
          aria-describedby="memory-auto-capture-description"
        />
      </div>
      <div id="memory-auto-capture-description" className="text-xs text-text-secondary">
        {localize('com_ui_memory_auto_capture_description')}
      </div>
    </div>
  );
}

export default MemorySwitch;
