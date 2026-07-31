import { test as base } from '@playwright/test';
import { freshServiceSession } from './auth';
import { purgeArgs, purgePreferences } from './state';

/**
 * `test` de la suite — à importer partout à la place de `@playwright/test`.
 *
 * Deux fixtures :
 *
 * - `storageState` (surcharge de l'option native) — chaque test s'authentifie par un login
 *   programmatique du compte de service, juste avant la création de son contexte. La suite ne
 *   dépend plus d'aucun `storageState` capturé à la main, ni d'aucun état laissé par le test
 *   précédent. Le pourquoi d'un login par test plutôt que par run — la rotation du refresh
 *   token — est documenté dans `lib/auth.ts`.
 * - `isolatedPreferences` — purge des préférences de conversation du `localStorage`, cf.
 *   `lib/state.ts`.
 *
 * L'ancienne fixture `persistRotatedSession`, qui relayait l'état rotaté de test en test en
 * réécrivant `auth.json`, a disparu : elle n'a plus d'objet dès lors que personne n'hérite
 * de la session de personne.
 */
export const test = base.extend<{
  isolatedPreferences: void;
}>({
  storageState: async ({ baseURL }, use) => {
    await use(await freshServiceSession(baseURL as string));
  },

  /**
   * Isolation d'état — enregistrée sur le CONTEXTE (donc valable pour la page du test comme
   * pour tout onglet ouvert en cours de route, cf. SAV-01), avant le premier chargement de
   * page. Ne touche qu'aux clés de préférence de conversation : les cookies — seuls porteurs
   * de l'authentification — restent intacts. Détail du périmètre : `lib/state.ts`.
   */
  isolatedPreferences: [
    async ({ context }, use) => {
      await context.addInitScript(purgePreferences, purgeArgs);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
