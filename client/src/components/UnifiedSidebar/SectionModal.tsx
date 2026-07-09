import { memo } from 'react';
import type { ReactNode } from 'react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';

// Vermeer: interaction hors du contenu (pointerdown/interact) telle qu'émise par Radix.
type OutsideEvent = { detail?: { originalEvent?: Event }; preventDefault: () => void };

// Vermeer: mono-colonne — wrapper de modale générique pour les sections déplacées
// hors du panneau latéral (Assistants, Skills, Paramètres, Fichiers, Mémoires).
// Enrobe le panneau upstream tel quel, sans le modifier. Large (max-w-4xl) pour que
// la config du builder Assistants ne soit pas coupée.
//
// nonModal : le dialogue Radix ne bloque plus les événements pointer → les popovers
// Ariakit portalisés (Select Catégorie/Fournisseur/Modèle du builder) redeviennent
// cliquables. On empêche alors la fermeture du dialogue quand l'interaction cible un
// popover (sinon cliquer dans le menu déroulant fermerait la modale).
function SectionModal({
  open,
  onOpenChange,
  title,
  children,
  nonModal = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  nonModal?: boolean;
}) {
  const keepOpenOnPopover = (event: OutsideEvent) => {
    const target = event.detail?.originalEvent?.target;
    if (
      target instanceof Element &&
      target.closest('.animate-popover, .animate-popover-top, [role="listbox"], [role="menu"]')
    ) {
      event.preventDefault();
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} modal={nonModal ? false : undefined}>
      <OGDialogContent
        className="flex h-[85vh] max-h-[85vh] w-11/12 max-w-4xl flex-col overflow-hidden"
        {...(nonModal
          ? { onPointerDownOutside: keepOpenOnPopover, onInteractOutside: keepOpenOnPopover }
          : {})}
      >
        <OGDialogHeader>
          <OGDialogTitle>{title}</OGDialogTitle>
        </OGDialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </OGDialogContent>
    </OGDialog>
  );
}

export default memo(SectionModal);
