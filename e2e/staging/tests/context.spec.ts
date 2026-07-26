import { expect, test } from '../lib/test';
import type { Locator, Page } from '@playwright/test';
import { ask, expectHealthyAnswer, navItem, newConversation, openDialog } from '../lib/app';

const CUSTOM_VALUE = '50000';
const FIELD = '#maxContextTokens-dynamic-input';

test(
  'CTX-02 — la valeur utilisateur de contexte persiste, sans contaminer une nouvelle conversation',
  { tag: ['@wave1'] },
  async ({ page }) => {
    await newConversation(page);
    await openParameters(page);

    const field = page.locator(FIELD);

    /**
     * La modale Paramètres de Vermeer est le panneau « light » : Créativité, Réflexion
     * approfondie, Recherche web, Mémoire automatique. Le champ « Jetons de contexte
     * maximum » n'y est pas exposé (les réglages avancés sont masqués côté Vermeer,
     * cf. `SHOW_ADVANCED_SETTINGS`), et il n'existe aucun autre point d'entrée UI pour
     * saisir la valeur. CTX-02 tel que rédigé n'est donc pas exerçable sur ce build : on
     * l'annonce explicitement au lieu de conclure au vert.
     *
     * Ce test redeviendra actif de lui-même si le réglage est ré-exposé.
     */
    const fieldExists = (await field.count()) > 0;
    test.skip(
      !fieldExists,
      [
        'CTX-02 non exerçable : le champ « Jetons de contexte maximum » n’est pas exposé dans',
        'la modale Paramètres de ce build (panneau « light », réglages avancés masqués).',
        'Vérification manuelle requise, ou ré-exposition du réglage — voir e2e/staging/README.md § Divergences.',
      ].join(' '),
    );

    await expect(field).toBeVisible({ timeout: 15_000 });
    await field.fill(CUSTOM_VALUE);
    await expect(field).toHaveValue(CUSTOM_VALUE);
    await closeParameters(page);

    const result = await ask(page, 'Réponds en un mot: ok');
    await expectHealthyAnswer(page, result, 'CTX-02 (envoi avec contexte personnalisé)');

    expect(
      result.request?.maxContextTokens,
      `La valeur saisie n'est pas transmise à la complétion : ${JSON.stringify(result.request?.maxContextTokens)}.`,
    ).toBe(Number(CUSTOM_VALUE));

    const conversationUrl = page.url();

    /* (3) après rechargement, la valeur personnalisée doit être toujours là. */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openParameters(page);
    await expect(
      page.locator(FIELD),
      `La valeur ${CUSTOM_VALUE} n'a pas persisté sur la conversation après rechargement (régression du fix v0.10.15/16).`,
    ).toHaveValue(CUSTOM_VALUE, { timeout: 20_000 });
    await closeParameters(page);

    /* (4) une conversation NEUVE ne doit pas hériter de la valeur (garde anti-contamination). */
    await newConversation(page);
    await openParameters(page);
    const freshField = page.locator(FIELD);
    await expect(freshField).toBeVisible({ timeout: 15_000 });
    await expect(
      freshField,
      [
        `Une nouvelle conversation hérite de la valeur de contexte (${CUSTOM_VALUE}) :`,
        'régression de la garde anti-contamination (LAST_CONVO_SETUP, PR #28).',
        `Conversation source : ${conversationUrl}`,
      ].join(' '),
    ).toHaveValue('', { timeout: 20_000 });

    /* Champ vide = placeholder « Système ». */
    await expect(freshField).toHaveAttribute('placeholder', /système|system/i);
    await closeParameters(page);
  },
);

async function openParameters(page: Page): Promise<Locator> {
  await navItem(page, /^paramètres$|^parameters$/i).click();
  const dialog = openDialog(page).first();
  await expect(dialog, 'La modale Paramètres ne s’ouvre pas.').toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function closeParameters(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(openDialog(page)).toHaveCount(0, { timeout: 15_000 });
}
