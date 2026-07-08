import { memo } from 'react';
import type { ReactNode } from 'react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';

// Vermeer: mono-colonne — wrapper de modale pour les sections déplacées hors du
// panneau latéral (Fichiers, Mémoires). Enrobe le panneau upstream tel quel, sans
// le modifier.
function SectionModal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="flex max-h-[85vh] w-11/12 max-w-3xl flex-col overflow-hidden">
        <OGDialogHeader>
          <OGDialogTitle>{title}</OGDialogTitle>
        </OGDialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </OGDialogContent>
    </OGDialog>
  );
}

export default memo(SectionModal);
