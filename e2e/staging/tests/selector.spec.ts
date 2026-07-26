import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';
import {
  closeModelSelector,
  modelSelectorList,
  modelSelectorOptions,
  newConversation,
  openModelSelector,
} from '../lib/app';
import { EXPECTED_CATALOGUE, FORBIDDEN_MODELS } from '../lib/models';

const GROUP_LABELS = EXPECTED_CATALOGUE.map((entry) => normalize(entry.group));

test(
  'SEL-01 — groupes et modèles du sélecteur conformes à la config attendue',
  { tag: ['@wave1', '@canary'] },
  async ({ page }) => {
    await newConversation(page);

    for (const { group, models, ordered } of EXPECTED_CATALOGUE) {
      /* Sélecteur réouvert pour chaque groupe : un seul groupe déplié à la fois. */
      await openModelSelector(page);
      const groupOption = modelSelectorList(page)
        .getByRole('option', { name: new RegExp(`^\\s*${escapeRegExp(group)}`, 'i') })
        .first();
      await expect(
        groupOption,
        `Groupe « ${group} » absent du sélecteur de modèles.`,
      ).toBeVisible({ timeout: 10_000 });

      await groupOption.click();

      await expect
        .poll(async () => (await modelLabels(page)).length, {
          timeout: 10_000,
          message: `Le groupe « ${group} » n'a déplié aucun modèle.`,
        })
        .toBeGreaterThan(0);

      const labels = await modelLabels(page);

      for (const model of models) {
        expect(
          labels.some((label) => label.includes(normalize(model))),
          `Modèle « ${model} » absent du groupe « ${group} ». Modèles lus : ${labels.join(' | ') || 'aucun'}.`,
        ).toBe(true);
      }

      expect(
        labels.length,
        `Le groupe « ${group} » expose ${labels.length} modèle(s) au lieu de ${models.length} attendu(s) : ${labels.join(' | ')}.`,
      ).toBe(models.length);

      if (ordered) {
        const positions = models.map((model) =>
          labels.findIndex((label) => label.includes(normalize(model))),
        );
        expect(
          positions,
          `Ordre inattendu dans « ${group} ». Attendu : ${models.join(' > ')}. Lu : ${labels.join(' | ')}.`,
        ).toEqual([...positions].sort((a, b) => a - b));
      }

      for (const forbidden of FORBIDDEN_MODELS) {
        expect(
          labels.some((label) => label.includes(normalize(forbidden))),
          `Le modèle « ${forbidden} » doit être absent du sélecteur (retiré de la config), trouvé dans « ${group} ».`,
        ).toBe(false);
      }

      await closeModelSelector(page);
    }
  },
);

/** Options du sélecteur qui ne sont pas des en-têtes de groupe. */
async function modelLabels(page: Page): Promise<string[]> {
  const texts = await modelSelectorOptions(page).allTextContents();
  return texts
    .map((text) => normalize(text))
    .filter((text) => text !== '')
    .filter((text) => !GROUP_LABELS.some((group) => text === group || text === `${group}selected`));
}

/**
 * Comparaison tolérante à la ponctuation : la recette écrit « Gemini 2.5 Flash-lite »
 * là où la config expose « Gemini 2.5 Flash lite (Rapide) ». Ce qui est asservi est
 * l'identité du modèle, pas sa césure.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-–_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
