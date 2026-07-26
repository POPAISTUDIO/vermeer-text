import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';
import { composer, navItem, openApp, openDialog } from '../lib/app';

type CloseMode = 'escape' | 'backdrop' | 'button';

type Section = {
  id: string;
  nav: RegExp;
  close: CloseMode;
};

/** Sections et modes de fermeture, dans l'ordre des étapes de MOD-02. */
const SECTIONS: Section[] = [
  { id: 'Fichiers (historique des fichiers)', nav: /fichiers|historique des fichiers/i, close: 'escape' },
  { id: 'Mémoires', nav: /mémoires|memories/i, close: 'backdrop' },
  { id: 'Skills', nav: /skills/i, close: 'button' },
  { id: 'Paramètres', nav: /^paramètres$|^parameters$/i, close: 'escape' },
];

test(
  'MOD-02 — chaque section s’ouvre en modale et se ferme (Esc, backdrop, X)',
  { tag: ['@wave1'] },
  async ({ page }) => {
    await openApp(page);

    for (const section of SECTIONS) {
      const trigger = navItem(page, section.nav);
      await expect(
        trigger,
        `Section « ${section.id} » : élément de navigation introuvable dans la sidebar.`,
      ).toBeVisible({ timeout: 15_000 });

      await trigger.click();

      const dialog = openDialog(page).first();
      await expect(
        dialog,
        `Section « ${section.id} » : aucune modale ouverte (attendu : modale centrée avec overlay).`,
      ).toBeVisible({ timeout: 15_000 });

      await closeDialog(page, dialog, section);

      await expect(
        openDialog(page),
        `Section « ${section.id} » : la modale ne se ferme pas via ${section.close}.`,
      ).toHaveCount(0, { timeout: 15_000 });

      /* Pas de panneau latéral résiduel : le chat redevient pleinement utilisable. */
      await expect(
        composer(page),
        `Section « ${section.id} » : le composer n'est pas retrouvé après fermeture (panneau résiduel ?).`,
      ).toBeVisible({ timeout: 15_000 });

      /* La section doit pouvoir se réouvrir proprement. */
      await trigger.click();
      await expect(
        openDialog(page).first(),
        `Section « ${section.id} » : réouverture impossible après fermeture.`,
      ).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');
      await expect(openDialog(page)).toHaveCount(0, { timeout: 15_000 });
    }
  },
);

async function closeDialog(
  page: Page,
  dialog: ReturnType<typeof openDialog>,
  section: Section,
): Promise<void> {
  if (section.close === 'escape') {
    await page.keyboard.press('Escape');
    return;
  }

  if (section.close === 'backdrop') {
    /* Clic dans l'overlay, hors du contenu de la modale. */
    await page.mouse.click(8, 8);
    return;
  }

  const closeButton = dialog.getByRole('button', { name: /close|fermer/i }).first();
  await expect(
    closeButton,
    `Section « ${section.id} » : bouton de fermeture (X) introuvable dans la modale.`,
  ).toBeVisible({ timeout: 10_000 });
  await closeButton.click();
}
