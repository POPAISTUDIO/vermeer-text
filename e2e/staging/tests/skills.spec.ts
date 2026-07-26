import { expect, test } from '../lib/test';
import { navItem, openApp, openDialog } from '../lib/app';

test(
  'SKL-01c — la sélection en 1 clic d’un skill ferme la modale de création (Réf. #103)',
  { tag: ['@extra'] },
  async ({ page }) => {
    await openApp(page);

    await navItem(page, /^skills$/i).click();
    const skillsModal = openDialog(page).first();
    await expect(skillsModal, "La modale Skills ne s'ouvre pas.").toBeVisible({ timeout: 15_000 });

    /**
     * Le cas n'a de sens que s'il existe au moins un skill à cliquer.
     * On distingue explicitement les deux causes d'une liste vide, pour ne JAMAIS
     * conclure par défaut : le script exploratoire renvoyait « CODE-VERIFIED » et un PASS
     * sur liste vide, ce qui masquait entièrement la régression que ce cas doit détecter.
     * (L'API `/api/skills` n'est pas interrogeable ici : le jeton d'accès vit en mémoire
     * du client, pas dans un cookie — un appel direct répond 401.)
     */
    const skillRows = skillsModal.locator('[role="button"]').filter({ hasText: /\S/ });
    const emptyState = skillsModal.getByText(/aucun skill|no skills/i);

    await expect
      .poll(async () => (await skillRows.count()) + (await emptyState.count()), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const rowCount = await skillRows.count();
    if (rowCount === 0) {
      expect(
        await emptyState.count(),
        'Ni ligne de skill, ni état vide dans la modale Skills : le sélecteur de liste est à revoir.',
      ).toBeGreaterThan(0);
    }

    expect(
      rowCount,
      [
        'SKL-01c non exerçable : aucun skill sur le compte QA de cet environnement.',
        'Créer au moins un skill sur ce compte (la sélection en 1 clic ne peut pas être',
        'exercée sur une liste vide), puis relancer. Ne pas neutraliser ce test.',
      ].join(' '),
    ).toBeGreaterThan(0);

    const createButton = page.getByRole('button', { name: /créer un skill|create skill/i }).first();
    await expect(
      createButton,
      'Bouton « Créer un skill » introuvable dans la modale Skills.',
    ).toBeVisible({ timeout: 15_000 });
    await createButton.click();

    /* La modale de création est un dialogue distinct, empilé sur la liste. */
    const createDialog = page
      .getByRole('dialog')
      .filter({ hasText: /créer un skill|create skill/i })
      .first();
    await expect(createDialog, 'La modale de création de skill ne s’ouvre pas.').toBeVisible({
      timeout: 15_000,
    });

    /* Le clic sur un skill de la liste doit fermer la modale de création (#103). */
    await skillRows.first().click();

    await expect(
      createDialog,
      'La modale de création est restée ouverte après la sélection d’un skill : régression de la sélection en 1 clic (Réf. #103).',
    ).toBeHidden({ timeout: 15_000 });
  },
);
